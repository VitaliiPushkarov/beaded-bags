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
} from '@/lib/product-inventory'
import { prisma } from '@/lib/prisma'

const BodySchema = z.object({
  status: z.nativeEnum(OrderStatus),
})

type PageProps = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: PageProps) {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  try {
    const { id } = await params
    const json = await req.json()
    const parsed = BodySchema.safeParse(json)
    let inventoryProductSnapshots: InventorySettlementProductSnapshot[] = []

    if (!parsed.success) {
      const formatted = parsed.error.format()
      return NextResponse.json({ error: formatted }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.order.update({
        where: { id },
        data: { status: parsed.data.status },
      })

      if (isInventorySettledOrderStatus(next.status)) {
        const settlement = await applyPaidOrderInventoryTx(tx, next.id)
        inventoryProductSnapshots = settlement.productSnapshots
      }

      return next
    })

    revalidatePath('/admin')
    revalidatePath('/admin/orders')
    revalidatePath('/admin/finance')
    if (inventoryProductSnapshots.length > 0) {
      revalidateInventoryProductViews(inventoryProductSnapshots)
    }

    return NextResponse.json({ id: updated.id, status: updated.status })
  } catch (err) {
    console.error('Update order status error', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
