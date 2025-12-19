import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Body = {
  productId: string
  productSlug?: string | null
  productName: string
  variantId: string
  variantColor?: string | null
  strapId?: string | null
  contactName?: string | null
  contact: string
  comment?: string | null
  source?: string | null
}

function clean(v: unknown) {
  return typeof v === 'string' ? v.trim() : ''
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json()) as Partial<Body>

    const productId = clean(raw.productId)
    const productName = clean(raw.productName)
    const variantId = clean(raw.variantId)
    const contact = clean(raw.contact)

    if (!productId || !productName || !variantId || !contact) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 1) Save to DB
    const lead = await prisma.preorderLead.create({
      data: {
        productId,
        productSlug: clean(raw.productSlug) || null,
        productName,
        variantId,
        variantColor: clean(raw.variantColor) || null,
        strapId: clean(raw.strapId) || null,
        contactName: clean(raw.contactName) || null,
        contact,
        comment: clean(raw.comment) || null,
        source: clean(raw.source) || 'product_page',
      },
    })
    // 2) send to Telegram
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
    const urlLine = raw.productSlug
      ? `https://gerdan.online/products/${raw.productSlug}`
      : ''

    const msg =
      `🧾 <b>Нове передзамовлення</b>\n` +
      `\n<b>Товар:</b> ${productName}` +
      `\n<b>Варіант:</b> ${raw.variantColor || raw.variantId}` +
      (raw.strapId ? `\n<b>StrapId:</b> ${raw.strapId}` : '') +
      `\n<b>Контакт:</b> ${contact}` +
      (raw.contactName ? `\n<b>Ім’я:</b> ${raw.contactName}` : '') +
      (raw.comment ? `\n<b>Коментар:</b> ${raw.comment}` : '') +
      (urlLine ? `\n<b>URL:</b> ${urlLine}` : '') +
      `\n\n<b>Lead ID:</b> ${lead.id}`

    sendTelegram(msg).catch(() => {})
    return NextResponse.json({ ok: true, id: lead.id })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 }
    )
  }
}
