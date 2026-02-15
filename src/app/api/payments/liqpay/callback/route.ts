import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { liqpaySign } from '@/lib/liqpay'
import { mapLiqPayOrderStatus } from '@/lib/liqpay-payment-status'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type LiqPayDecodedPayload = {
  order_id?: string
  status?: string
  transaction_id?: string | number
  [key: string]: unknown
}

async function parseLiqPayRequestBody(req: NextRequest): Promise<{
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

function safeEquals(a: string, b: string): boolean {
  const aa = Buffer.from(a)
  const bb = Buffer.from(b)
  if (aa.length !== bb.length) return false
  return crypto.timingSafeEqual(aa, bb)
}

export async function POST(req: NextRequest) {
  try {
    const privateKey = process.env.LIQPAY_PRIVATE_KEY?.trim()
    if (!privateKey) {
      console.error('LiqPay callback: missing LIQPAY_PRIVATE_KEY')
      return new NextResponse('missing key', { status: 500 })
    }

    const { data, signature } = await parseLiqPayRequestBody(req)
    if (!data || !signature) {
      console.error('LiqPay callback: missing data/signature')
      return new NextResponse('bad request', { status: 400 })
    }

    const expectedSignature = liqpaySign(privateKey, data)
    if (!safeEquals(expectedSignature, signature)) {
      console.error('LiqPay callback: signature mismatch')
      return new NextResponse('invalid signature', { status: 400 })
    }

    const decoded = JSON.parse(
      Buffer.from(data, 'base64').toString('utf8'),
    ) as LiqPayDecodedPayload

    const orderId = String(decoded.order_id ?? '')
    const paymentStatus = String(decoded.status ?? '')
    const paymentId =
      decoded.transaction_id !== undefined && decoded.transaction_id !== null
        ? String(decoded.transaction_id)
        : null

    if (!orderId) {
      console.error('LiqPay callback: missing order_id')
      return new NextResponse('bad request', { status: 400 })
    }

    const existing = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    })

    if (!existing) {
      console.error('LiqPay callback: order not found', orderId)
      return new NextResponse('ok')
    }

    const mappedOrderStatus = mapLiqPayOrderStatus({
      ...decoded,
      status: paymentStatus,
    })

    const updateData: Prisma.OrderUpdateInput = {
      paymentStatus: paymentStatus || null,
      paymentId,
      paymentRaw: decoded as Prisma.InputJsonValue,
    }

    if (
      mappedOrderStatus &&
      !(existing.status === 'PAID' && mappedOrderStatus !== 'PAID')
    ) {
      updateData.status = mappedOrderStatus
    }

    await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    })

    return new NextResponse('ok')
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.error('LiqPay callback error:', e.message)
    } else {
      console.error('LiqPay callback error:', e)
    }
    return new NextResponse('error', { status: 500 })
  }
}
