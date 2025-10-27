import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, OrderStatus } from '@prisma/client'
const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  // Fondy може присилати плоске тіло або у полі `order`
  const body = (await req.json()) as any
  const payload = body?.order ?? body

  const orderId = String(
    payload?.order_id ?? payload?.merchant_data?.orderId ?? ''
  )
  const fondyStatus: string = String(
    payload?.order_status ?? payload?.status ?? ''
  ).toLowerCase()

  // Мапінг Fondy -> наша enum
  let status: OrderStatus
  switch (fondyStatus) {
    case 'approved':
      status = OrderStatus.PAID
      break
    case 'created':
    case 'processing':
    case 'pending':
      status = OrderStatus.PENDING
      break
    default:
      status = OrderStatus.FAILED
  }

  if (!orderId) {
    return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status },
  })

  return NextResponse.json({ ok: true })
}
