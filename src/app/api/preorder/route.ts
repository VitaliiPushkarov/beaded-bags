import type { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isPreorderStatus, resolveAvailabilityStatus } from '@/lib/availability'
import {
  buildFallbackPreorderItems,
  buildPreorderTelegramMessage,
  formatUaPhone,
  isUaPhoneValid,
  normalizePreorderItems,
  type PreorderItemInput,
} from '@/lib/preorder'

type Body = {
  productId?: string
  productSlug?: string | null
  productName?: string
  variantId?: string
  variantColor?: string | null
  strapId?: string | null
  contactName?: string | null
  contact: string
  comment?: string | null
  source?: string | null
  items?: PreorderItemInput[] | null
}

function clean(v: unknown) {
  return typeof v === 'string' ? v.trim() : ''
}

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
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
    const rawContact = clean(raw.contact)
    const normalizedItems = normalizePreorderItems(raw.items)
    const fallbackItems = buildFallbackPreorderItems({
      productId: raw.productId ?? '',
      productSlug: raw.productSlug ?? null,
      productName: raw.productName ?? '',
      variantId: raw.variantId ?? '',
      variantColor: raw.variantColor ?? null,
      strapId: raw.strapId ?? null,
    })
    const items = normalizedItems.length ? normalizedItems : fallbackItems
    const primaryItem = items.find((item) => item.kind === 'main') ?? items[0]

    if (!primaryItem || !rawContact) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 },
      )
    }

    if (!isUaPhoneValid(rawContact)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid phone number' },
        { status: 400 },
      )
    }

    const contact = formatUaPhone(rawContact)

    const productId = primaryItem.productId
    const productName = primaryItem.productName
    const variantId = primaryItem.variantId

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
        productSlug: primaryItem.productSlug,
        productName,
        variantId,
        variantColor: primaryItem.variantColor,
        strapId: primaryItem.strapId,
        contactName: clean(raw.contactName) || null,
        contact,
        comment: clean(raw.comment) || null,
        items: items as Prisma.InputJsonValue,
        source: clean(raw.source) || 'product_page',
      },
    })
    // 2) Send to Telegram
    const contactName = clean(raw.contactName)
    const comment = clean(raw.comment)
    const productSlug = primaryItem.productSlug
    const urlLine = productSlug
      ? `https://gerdan.online/products/${productSlug}`
      : null

    const msg = buildPreorderTelegramMessage({
      leadId: lead.id,
      items,
      contact,
      contactName,
      comment,
      url: urlLine,
    })

    await sendTelegram(msg)
    return NextResponse.json({ ok: true, id: lead.id })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 },
    )
  }
}
