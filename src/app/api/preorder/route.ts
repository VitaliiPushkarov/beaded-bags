import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isPreorderStatus, resolveAvailabilityStatus } from '@/lib/availability'

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

function escHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

async function sendTelegram(text: string) {
  const token =
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    process.env.TELEGRAM_PRODUCTION_BOT_TOKEN?.trim()
  const chatId =
    process.env.TELEGRAM_CHAT_ID?.trim() ||
    process.env.TELEGRAM_PREORDER_CHAT_ID?.trim()

  if (!token || !chatId) {
    console.warn(
      'Preorder telegram is not configured: missing token/chat id env',
    )
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3500)

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('Preorder Telegram sendMessage failed:', res.status, body)
      return
    }

    console.info('Preorder Telegram sendMessage ok')
  } catch (error) {
    console.error('Preorder Telegram sendMessage error:', error)
  } finally {
    clearTimeout(timeout)
  }
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

    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
      select: {
        inStock: true,
        availabilityStatus: true,
      },
    })

    if (!variant) {
      return NextResponse.json(
        { ok: false, error: 'Variant not found' },
        { status: 404 },
      )
    }

    const availabilityStatus = resolveAvailabilityStatus({
      availabilityStatus: variant.availabilityStatus,
      inStock: variant.inStock,
    })

    if (!isPreorderStatus(availabilityStatus)) {
      return NextResponse.json(
        { ok: false, error: 'Preorder is closed for this variant' },
        { status: 409 },
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
    // 2) Send to Telegram
    const variantLabel = clean(raw.variantColor) || variantId
    const strapId = clean(raw.strapId)
    const contactName = clean(raw.contactName)
    const comment = clean(raw.comment)
    const productSlug = clean(raw.productSlug)
    const urlLine = productSlug
      ? `https://gerdan.online/products/${productSlug}`
      : ''

    const msg =
      `🧾 <b>Нове передзамовлення</b>\n` +
      `\n<b>Товар:</b> ${escHtml(productName)}` +
      `\n<b>Варіант:</b> ${escHtml(variantLabel)}` +
      (strapId ? `\n<b>StrapId:</b> ${escHtml(strapId)}` : '') +
      `\n<b>Контакт:</b> ${escHtml(contact)}` +
      (contactName ? `\n<b>Ім’я:</b> ${escHtml(contactName)}` : '') +
      (comment ? `\n<b>Коментар:</b> ${escHtml(comment)}` : '') +
      (urlLine ? `\n<b>URL:</b> ${escHtml(urlLine)}` : '') +
      `\n\n<b>Lead ID:</b> ${escHtml(lead.id)}`

    await sendTelegram(msg)
    return NextResponse.json({ ok: true, id: lead.id })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 }
    )
  }
}
