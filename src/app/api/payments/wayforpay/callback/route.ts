import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

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
      await prisma.order.update({
        where: { id: orderReference },
        data: { status: 'PAID' },
      })
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
