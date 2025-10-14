import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const { orderId, amountUAH, returnUrl } = await req.json()
  const merchant_id = process.env.FONDY_MERCHANT_ID!
  const password = process.env.FONDY_MERCHANT_PASSWORD!
  const order_desc = `Order ${orderId}`
  const currency = 'UAH'
  const response_url = returnUrl || `${process.env.PUBLIC_BASE_URL}/success`

  const payload = {
    request: {
      merchant_id,
      order_id: orderId,
      order_desc,
      amount: amountUAH * 100,
      currency,
      response_url,
      server_callback_url: `${process.env.PUBLIC_BASE_URL}/api/payments/fondy-webhook`,
    },
  }

  // Підпис (Fondy v2: signature = sha1(md5(JSON+password))) — перевір формулу у своїй докі
  const toSign = JSON.stringify(payload.request) + password
  const signature = crypto
    .createHash('sha1')
    .update(crypto.createHash('md5').update(toSign).digest('hex'))
    .digest('hex')

  ;(payload as any).request.signature = signature

  const res = await fetch(process.env.FONDY_API!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  // очікуємо data.response.checkout_url
  return NextResponse.json({
    url: data.response?.checkout_url ?? null,
    raw: data,
  })
}
