import { NextRequest, NextResponse } from 'next/server'
import { refreshOrderFromLiqPayStatusApi } from '@/lib/liqpay-settlement'
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
      paymentMethod: true,
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (orderNumberRaw && String(order.shortNumber) !== orderNumberRaw) {
    return NextResponse.json({ error: 'Order mismatch' }, { status: 404 })
  }

  let latest = order

  if (latest.paymentMethod === 'LIQPAY' && latest.status === 'PENDING') {
    const refreshed = await refreshOrderFromLiqPayStatusApi(latest.id)
    if (refreshed) {
      latest = refreshed
    }
  }

  return NextResponse.json(
    {
      orderId: latest.id,
      orderNumber: latest.shortNumber,
      status: latest.status,
      isFinal:
        latest.status === 'PAID' ||
        latest.status === 'FAILED' ||
        latest.status === 'CANCELLED',
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  )
}
