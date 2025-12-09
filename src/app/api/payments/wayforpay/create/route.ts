import { NextRequest, NextResponse } from 'next/server'
import { buildWayForPayPayload } from '@/lib/wayforpay'

export async function POST(req: NextRequest) {
  try {
    const { orderId, amountUAH, description, customer } = await req.json()

    if (!orderId || !amountUAH) {
      return NextResponse.json(
        { error: 'orderId and amountUAH required' },
        { status: 400 }
      )
    }

    const merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT!
    const merchantSecretKey = process.env.WAYFORPAY_MERCHANT_SECRET_KEY!
    const baseUrl = process.env.APP_BASE_URL || 'http://gerdan.online'

    if (!merchantAccount || !merchantSecretKey) {
      return NextResponse.json(
        { error: 'Missing WayForPay keys' },
        { status: 500 }
      )
    }

    const { payload, payUrl } = buildWayForPayPayload({
      merchantAccount,
      merchantSecretKey,
      orderReference: orderId,
      amountUAH,
      description: description || `Замовлення #${orderId}`,
      baseUrl,
      customer,
    })

    return NextResponse.json({
      payUrl,
      payload,
    })
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.error('WayForPay create error:', e.message)
    } else {
      console.error('WayForPay create error:', e)
    }

    return NextResponse.json(
      { error: 'wayforpay create failed' },
      { status: 500 }
    )
  }
}
