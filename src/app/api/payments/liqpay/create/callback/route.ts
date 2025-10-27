import { NextRequest, NextResponse } from 'next/server'
import { liqpaySign } from '@/lib/liqpay'
// import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const data = String(form.get('data') || '')
    const signature = String(form.get('signature') || '')

    const privateKey = process.env.LIQPAY_PRIVATE_KEY!
    const mySign = liqpaySign(privateKey, data)

    if (mySign !== signature) {
      console.error('LiqPay callback: signature mismatch')
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf8'))

    // приклади корисних полів
    /* const orderId: string = decoded.order_id
    const status: string = decoded.status // success, failure, error, reversed, sandbox, 3ds_verify, etc.
    const amount = decoded.amount
    const currency = decoded.currency */

    // тут оновлюємо замовлення в БД
    // if (status === "success" || status === "sandbox") {
    //   await prisma.order.update({ where: { id: orderId }, data: { status: "paid" } });
    // } else if (status === "failure" || status === "error") {
    //   await prisma.order.update({ where: { id: orderId }, data: { status: "failed" } });
    // }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('liqpay callback error:', e?.message || e)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
