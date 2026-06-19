import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import {
  applyPaidOrderInventoryTx,
  revalidateInventoryProductViews,
} from '@/lib/product-inventory'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  const { orderId } = await req.json()
  if (!orderId)
    return NextResponse.json(
      { ok: false, error: 'orderId required' },
      { status: 400 }
    )

  const inventorySettlement = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: String(orderId) },
      data: { status: 'PAID' },
    })

    return applyPaidOrderInventoryTx(tx, String(orderId))
  })

  revalidateInventoryProductViews(inventorySettlement.productSnapshots)

  return NextResponse.json({ ok: true })
}
