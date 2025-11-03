import { NextRequest, NextResponse } from 'next/server'
import { buildLiqPayPayload } from '@/lib/liqpay'
// якщо є Prisma-замовлення, можна підтягнути суму/опис з БД
// import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { orderId, amountUAH, description, customer } = await req.json()

    if (!orderId || !amountUAH) {
      return NextResponse.json(
        { error: 'orderId and amountUAH required' },
        { status: 400 }
      )
    }

    const publicKey = process.env.LIQPAY_PUBLIC_KEY!
    const privateKey = process.env.LIQPAY_PRIVATE_KEY!
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000'

    if (!publicKey || !privateKey) {
      return NextResponse.json(
        { error: 'Missing LiqPay keys' },
        { status: 500 }
      )
    }

    const { data, signature } = buildLiqPayPayload({
      publicKey,
      privateKey,
      orderId,
      amountUAH,
      description: description || `Замовлення #${orderId}`,
      resultUrl: `${baseUrl}/checkout/success?orderId=${encodeURIComponent(
        orderId
      )}`,
      serverUrl: `${baseUrl}/api/payments/liqpay/callback`,
      customer,
    })

    return NextResponse.json({
      checkoutUrl: 'https://www.liqpay.ua/api/3/checkout',
      data,
      signature,
    })
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.error('liqpay create error:', e.message)
    } else {
      console.error('Create order error:', e)
    }

    return NextResponse.json({ error: 'liqpay create failed' }, { status: 500 })
  }
}
