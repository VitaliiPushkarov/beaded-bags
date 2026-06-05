import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { liqpaySign } from '@/lib/liqpay'
import { mapLiqPayOrderStatus } from '@/lib/liqpay-payment-status'

export const runtime = 'nodejs'
const REDIRECT_STATUS = 303

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
  return NextResponse.redirect(new URL('/', toBasePath(req)), REDIRECT_STATUS)
}

function toCheckout(req: NextRequest, reason?: string) {
  const url = new URL('/checkout', toBasePath(req))
  if (reason) url.searchParams.set('payment', reason)
  return NextResponse.redirect(url, REDIRECT_STATUS)
}

function toSuccess(
  req: NextRequest,
  input: { orderNumber: string | number; orderId: string; pending?: boolean },
) {
  const url = new URL('/checkout/success', toBasePath(req))
  url.searchParams.set('order', String(input.orderNumber))
  url.searchParams.set('orderId', input.orderId)
  if (input.pending) url.searchParams.set('pending', '1')
  return NextResponse.redirect(url, REDIRECT_STATUS)
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

async function parsePostedReturnBody(req: NextRequest): Promise<{
  data: string
  signature: string
}> {
  const contentType = req.headers.get('content-type')?.toLowerCase() || ''

  if (contentType.includes('application/json')) {
    const body = (await req.json()) as { data?: unknown; signature?: unknown }
    return {
      data: String(body?.data ?? ''),
      signature: String(body?.signature ?? ''),
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const raw = await req.text()
    const params = new URLSearchParams(raw)
    return {
      data: String(params.get('data') ?? ''),
      signature: String(params.get('signature') ?? ''),
    }
  }

  const form = await req.formData()
  return {
    data: String(form.get('data') ?? ''),
    signature: String(form.get('signature') ?? ''),
  }
}

async function waitForFinalStatus(orderId: string, attempts = 8, delayMs = 500) {
  let latest = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, shortNumber: true, id: true },
  })

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (!latest) return null
    if (
      latest.status === 'PAID' ||
      latest.status === 'FAILED' ||
      latest.status === 'CANCELLED'
    ) {
      return latest
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs))
    latest = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, shortNumber: true, id: true },
    })
  }

  return latest
}

async function handleReturn(args: {
  req: NextRequest
  data?: string
  signature?: string
  searchParams?: URLSearchParams
}) {
  const { req } = args
  const sp = args.searchParams ?? req.nextUrl.searchParams
  const data = String(args.data ?? sp.get('data') ?? '')
  const signature = String(args.signature ?? sp.get('signature') ?? '')
  const privateKey = process.env.LIQPAY_PRIVATE_KEY?.trim()

  const decoded = decodePayload(data)
  let trustedPayload: DecodedPayload | null = null

  if (decoded && data && signature && privateKey) {
    const expected = liqpaySign(privateKey, data)
    if (!safeEqual(expected, signature)) {
      return toHome(req)
    }

    trustedPayload = decoded
  }

  const orderId =
    pickOrderId(sp, trustedPayload) ||
    String(sp.get('order_id') ?? sp.get('orderId') ?? '').trim()
  const paymentStatus = trustedPayload ? pickStatus(sp, trustedPayload) : ''
  const mappedOrderStatus = trustedPayload
    ? mapLiqPayOrderStatus({
        ...trustedPayload,
        status: paymentStatus || trustedPayload?.status,
      })
    : null

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

  if (trustedPayload) {
    const updateData: Prisma.OrderUpdateInput = {
      paymentStatus: paymentStatus || null,
      paymentRaw: trustedPayload as Prisma.InputJsonValue,
    }

    if (
      trustedPayload.transaction_id !== undefined &&
      trustedPayload.transaction_id !== null
    ) {
      updateData.paymentId = String(trustedPayload.transaction_id)
    }

    if (
      mappedOrderStatus &&
      !(existing.status === 'PAID' && mappedOrderStatus !== 'PAID')
    ) {
      updateData.status = mappedOrderStatus
    }

    await prisma.order.update({
      where: { id: existing.id },
      data: updateData,
    })
  }

  const finalStatus =
    mappedOrderStatus && !(existing.status === 'PAID' && mappedOrderStatus !== 'PAID')
      ? mappedOrderStatus
      : existing.status

  if (finalStatus === 'PAID') {
    return toSuccess(req, {
      orderNumber: existing.shortNumber,
      orderId: existing.id,
    })
  }

  if (finalStatus === 'CANCELLED') {
    return toCheckout(req, 'cancelled')
  }

  if (finalStatus === 'FAILED') {
    return toCheckout(req, 'failed')
  }

  const settled = await waitForFinalStatus(existing.id)

  if (settled?.status === 'PAID') {
    return toSuccess(req, {
      orderNumber: settled.shortNumber,
      orderId: settled.id,
    })
  }

  if (settled?.status === 'CANCELLED') {
    return toCheckout(req, 'cancelled')
  }

  if (settled?.status === 'FAILED') {
    return toCheckout(req, 'failed')
  }

  return toSuccess(req, {
    orderNumber: existing.shortNumber,
    orderId: existing.id,
    pending: true,
  })
}

export async function GET(req: NextRequest) {
  return handleReturn({ req })
}

export async function POST(req: NextRequest) {
  const { data, signature } = await parsePostedReturnBody(req)
  return handleReturn({ req, data, signature })
}
