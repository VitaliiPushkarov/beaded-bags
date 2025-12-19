import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      merchantAccount,
      orderReference,
      amount,
      currency,
      authCode,
      cardPan,
      transactionStatus,
      reasonCode,
      merchantSignature,
    } = body

    const secretKey = process.env.WAYFORPAY_MERCHANT_SECRET_KEY!
    const signatureSource = [
      merchantAccount,
      orderReference,
      amount,
      currency,
      authCode,
      cardPan,
      transactionStatus,
      reasonCode,
    ].join(';')

    const mySign = crypto
      .createHmac('md5', secretKey)
      .update(signatureSource)
      .digest('hex')

    if (mySign !== merchantSignature) {
      console.error('WayForPay callback: signature mismatch')
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    if (transactionStatus === 'Approved') {
      const order = await prisma.order.update({
        where: { id: orderReference },
        data: { status: 'PAID' },
        select: {
          id: true,
          shortNumber: true,
          totalUAH: true,
          paymentMethod: true,
        },
      })

      const msg =
        `✅ <b>Оплата підтверджена</b>\n` +
        `\n<b>Замовлення:</b> ${order.shortNumber || order.id}` +
        `\n<b>Сума:</b> ${Math.round(order.totalUAH)} ₴` +
        `\n<b>Оплата:</b> ${order.paymentMethod}`

      // best-effort telegram notify
      sendTelegram(msg).catch(() => {})
    } else if (
      transactionStatus === 'Declined' ||
      transactionStatus === 'Expired'
    ) {
      await prisma.order.update({
        where: { id: orderReference },
        data: { status: 'FAILED' },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    console.error('WayForPay callback error:', e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
