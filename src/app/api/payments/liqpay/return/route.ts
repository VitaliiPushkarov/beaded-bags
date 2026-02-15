import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { liqpaySign } from '@/lib/liqpay'
import { mapLiqPayOrderStatus } from '@/lib/liqpay-payment-status'

export const runtime = 'nodejs'

type DecodedPayload = {
  order_id?: string
  status?: string
  transaction_id?: string | number
  [key: string]: unknown
}

function toBasePath(req: NextRequest) {
  return `${req.nextUrl.protocol}//${req.nextUrl.host}`
}

function toHome(req: NextRequest) {
  return NextResponse.redirect(new URL('/', toBasePath(req)))
}

function toCheckout(req: NextRequest, reason?: string) {
  const url = new URL('/checkout', toBasePath(req))
  if (reason) url.searchParams.set('payment', reason)
  return NextResponse.redirect(url)
}

function decodePayload(data: string): DecodedPayload | null {
  if (!data) return null
  try {
    return JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as DecodedPayload
  } catch {
    return null
  }
}

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a)
  const bb = Buffer.from(b)
  if (aa.length !== bb.length) return false
  return crypto.timingSafeEqual(aa, bb)
}

function pickOrderId(sp: URLSearchParams, decoded: DecodedPayload | null): string {
  return String(
    decoded?.order_id ??
      sp.get('order_id') ??
      sp.get('orderId') ??
      '',
  ).trim()
}

function pickStatus(sp: URLSearchParams, decoded: DecodedPayload | null): string {
  return String(decoded?.status ?? sp.get('status') ?? '').trim()
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams

  const data = String(sp.get('data') ?? '')
  const signature = String(sp.get('signature') ?? '')
  const privateKey = process.env.LIQPAY_PRIVATE_KEY?.trim()

  let decoded: DecodedPayload | null = decodePayload(data)

  // If return URL carries signed payload, verify it before trusting fields.
  if (decoded && data && signature && privateKey) {
    const expected = liqpaySign(privateKey, data)
    if (!safeEqual(expected, signature)) {
      return toHome(req)
    }
  } else if (!decoded) {
    // Fallback for flows that send plain query fields only.
    decoded = {
      order_id: sp.get('order_id') ?? undefined,
      status: sp.get('status') ?? undefined,
    }
  }

  const orderId = pickOrderId(sp, decoded)
  const paymentStatus = pickStatus(sp, decoded)
  const mappedOrderStatus = mapLiqPayOrderStatus({
    ...decoded,
    status: paymentStatus || decoded?.status,
  })

  if (!orderId) {
    return toHome(req)
  }

  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, shortNumber: true, status: true },
  })

  if (!existing) {
    return toHome(req)
  }

  const updateData: Prisma.OrderUpdateInput = {
    paymentStatus: paymentStatus || null,
    paymentRaw: decoded as Prisma.InputJsonValue,
  }

  if (decoded?.transaction_id !== undefined && decoded?.transaction_id !== null) {
    updateData.paymentId = String(decoded.transaction_id)
  }

  // Do not downgrade already paid orders.
  if (mappedOrderStatus && !(existing.status === 'PAID' && mappedOrderStatus !== 'PAID')) {
    updateData.status = mappedOrderStatus
  }

  await prisma.order.update({
    where: { id: existing.id },
    data: updateData,
  })

  const finalStatus =
    mappedOrderStatus && !(existing.status === 'PAID' && mappedOrderStatus !== 'PAID')
      ? mappedOrderStatus
      : existing.status

  if (finalStatus === 'PAID') {
    return NextResponse.redirect(
      new URL(
        `/checkout/success?order=${encodeURIComponent(String(existing.shortNumber))}`,
        toBasePath(req),
      ),
    )
  }

  if (finalStatus === 'CANCELLED') {
    return toCheckout(req, 'cancelled')
  }

  if (finalStatus === 'FAILED') {
    return toCheckout(req, 'failed')
  }

  return toCheckout(req)
}
