import { enqueueOrderEmailTx } from '@/lib/order-email-queue'
import { scheduleOrderEmails } from '@/lib/order-email-dispatch'
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
      const existing = await tx.order.findUniqueOrThrow({ where: { id }, select: { status: true } })
      const next = await tx.order.update({
        where: { id },
        data: { status: parsed.data.status },
      })

      if (isInventorySettledOrderStatus(next.status)) {
        const settlement = await applyPaidOrderInventoryTx(tx, next.id)
        inventoryProductSnapshots = settlement.productSnapshots
      } else {
        // Leaving a settled state (e.g. PAID -> CANCELLED) restores stock.
        const reversal = await reversePaidOrderInventoryTx(tx, next.id)
        inventoryProductSnapshots = reversal.productSnapshots
      }

      if (next.status === 'PAID' && existing.status !== 'PAID' && existing.status !== 'FULFILLED') {
        await enqueueOrderEmailTx(tx, next, 'PAID')
      }
      return next
    })

    if (updated.status === 'PAID') scheduleOrderEmails(updated.id)

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
