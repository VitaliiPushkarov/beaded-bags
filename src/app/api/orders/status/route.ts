import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const orderId = String(req.nextUrl.searchParams.get('orderId') ?? '').trim()
  const orderNumberRaw = String(req.nextUrl.searchParams.get('order') ?? '').trim()

  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      shortNumber: true,
      status: true,
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (orderNumberRaw && String(order.shortNumber) !== orderNumberRaw) {
    return NextResponse.json({ error: 'Order mismatch' }, { status: 404 })
  }

  return NextResponse.json(
    {
      orderId: order.id,
      orderNumber: order.shortNumber,
      status: order.status,
      isFinal:
        order.status === 'PAID' ||
        order.status === 'FAILED' ||
        order.status === 'CANCELLED',
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  )
}
