import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { OrderStatus } from '@prisma/client'

import { requireAdmin } from '@/lib/admin-auth'
import { isInventorySettledOrderStatus } from '@/lib/inventory-status'
import {
  applyPaidOrderInventoryTx,
  type InventorySettlementProductSnapshot,
  revalidateInventoryProductViews,
  reversePaidOrderInventoryTx,
} from '@/lib/product-inventory'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const BodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  status: z.nativeEnum(OrderStatus),
})

export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  const parsed = BodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { ids, status } = parsed.data
  const uniqueIds = Array.from(new Set(ids))
  const snapshots: InventorySettlementProductSnapshot[] = []
  let updated = 0

  // One transaction per order so a single failure doesn't roll back the rest,
  // and each order's inventory is settled/reversed exactly like the
  // single-order status route.
  for (const id of uniqueIds) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.order.findUnique({
          where: { id },
          select: { id: true },
        })
        if (!existing) return null

        const next = await tx.order.update({
          where: { id },
          data: { status },
        })

        const settlement = isInventorySettledOrderStatus(next.status)
          ? await applyPaidOrderInventoryTx(tx, next.id)
          : await reversePaidOrderInventoryTx(tx, next.id)

        return settlement.productSnapshots
      })

      if (result) {
        snapshots.push(...result)
        updated += 1
      }
    } catch (error) {
      console.error(`bulk-status: failed for order ${id}`, error)
    }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/orders')
  revalidatePath('/admin/finance')
  if (snapshots.length > 0) {
    revalidateInventoryProductViews(snapshots)
  }

  return NextResponse.json({ updated })
}
