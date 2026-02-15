import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { PROMO_CODE, calcDiscountUAH } from '@/lib/promo'

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    console.warn(
      'Telegram is not configured: missing TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID',
    )
    return
  }

  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 2000)

    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      },
    )

    clearTimeout(t)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('Telegram sendMessage failed:', res.status, body)
      return
    }

    console.info('Telegram sendMessage ok')
  } catch (e) {
    console.error('Telegram sendMessage error:', e)
  }
}

function formatUAH(v: number) {
  const n = Math.round(Number(v) || 0)
  return `${n} ₴`
}
function shortNumber(n: number) {
  const t = Math.round(Number(n) || 0)
  return `${t}`
}
function paymentMethodName(method: string) {
  switch (method) {
    case 'LIQPAY':
      return 'LiqPay'
    case 'COD':
      return 'Післяплата'
    case 'BANK_TRANSFER':
      return 'Банківський переказ'
    default:
      return method
  }
}
function escHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

// те, що приходить з фронта
const OrderItemAddon = z.object({
  addonVariantId: z.string().min(1),
  name: z.string().min(1),
  priceUAH: z.number().min(0),
  qty: z.number().int().min(1),
})

const OrderItem = z.object({
  productId: z.string().optional().nullable(),
  variantId: z.string().optional().nullable(),
  name: z.string().min(1),
  qty: z.number().int().min(1),
  priceUAH: z.number().min(0),
  strapName: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  addons: z.array(OrderItemAddon).optional().nullable(),
})

const BodySchema = z.object({
  items: z.array(OrderItem).min(1),
  amountUAH: z.number().min(0),
  promoCode: z.string().optional().nullable(),
  customer: z.object({
    name: z.string().min(2),
    surname: z.string().min(2),
    patronymic: z.string().optional().nullable(),
    phone: z.string().min(10),
    email: z.string().email().optional().nullable(),
  }),
  shipping: z.object({
    method: z.literal('nova_poshta'),
    np: z.object({
      cityRef: z.string().min(1),
      cityName: z.string().min(1),
      warehouseRef: z.string().min(1),
      warehouseName: z.string().min(1),
    }),
  }),
  // frontend може передати варіант оплати, але ми його зафіксуємо нижче
  paymentMethod: z
    .enum(['LIQPAY', 'COD', 'BANK_TRANSFER'])
    .optional(),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = BodySchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const data = parsed.data

    // перерахунок суми на бекенді
    const subtotal = data.items.reduce(
      (sum, item) => sum + item.priceUAH * item.qty,
      0,
    )

    // поки доставка 0
    const deliveryUAH = 0
    const promoOn =
      data.promoCode?.trim().toUpperCase() === PROMO_CODE ? true : false
    const discountUAH = calcDiscountUAH(subtotal, promoOn)
    const totalUAH = Math.max(0, subtotal + deliveryUAH - discountUAH)

    if (Math.round(totalUAH) !== Math.round(data.amountUAH)) {
      return NextResponse.json(
        { error: { _errors: ['amountUAH mismatch'] } },
        { status: 400 },
      )
    }

    // важливо: у схемі paymentMethod обов’язковий
    const paymentMethod = data.paymentMethod ?? 'LIQPAY'

    const created = await prisma.order.create({
      data: {
        status: 'PENDING',
        subtotalUAH: subtotal,
        deliveryUAH,
        discountUAH,
        totalUAH,

        customerName: data.customer.name,
        customerSurname: data.customer.surname,
        customerPatronymic: data.customer.patronymic ?? null,
        customerPhone: data.customer.phone,
        customerEmail: data.customer.email ?? null,

        npCityRef: data.shipping.np.cityRef,
        npCityName: data.shipping.np.cityName,
        npWarehouseRef: data.shipping.np.warehouseRef,
        npWarehouseName: data.shipping.np.warehouseName,

        paymentMethod,
        paymentId: null,
        paymentStatus: null,

        items: {
          create: data.items.map((it) => ({
            productId: it.productId ?? null,
            variantId: it.variantId ?? null,
            name: it.name,
            color: it.color ?? null,
            image: it.image ?? null,
            priceUAH: it.priceUAH,
            qty: it.qty,
            strapName: it.strapName ?? null,
            addons: it.addons ?? [],
          })),
        },
      },
      include: {
        items: true,
      },
    })

    // Telegram notification (best-effort)
    try {
      const itemsText = created.items
        .map((i) => {
          const addonsText = Array.isArray((i as any).addons)
            ? ((i as any).addons as any[])
                .map((a) => a?.name)
                .filter(Boolean)
                .join(', ')
            : ''

          const line =
            `• ${i.name}` +
            (i.color ? ` — ${i.color}` : '') +
            (i.strapName ? `\n  ↳ ремінець: ${i.strapName}` : '') +
            (addonsText ? `\n  ↳ додатково: ${addonsText}` : '') +
            ` × ${i.qty} — ${formatUAH(i.priceUAH)}`
          return escHtml(line)
        })
        .join('\n')

      const msg =
        `🛍 <b>Нове замовлення</b>\n` +
        `\n<b>Номер:</b> ${escHtml(shortNumber(created.shortNumber))}` +
        `\n<b>Сума:</b> ${escHtml(formatUAH(created.totalUAH))}` +
        `\n<b>Оплата:</b> ${escHtml(paymentMethodName(created.paymentMethod))}\n` +
        `\n<b>Доставка:</b> Нова пошта` +
        `\n<b>Місто:</b> ${escHtml(created.npCityName)}` +
        `\n<b>Відділення:</b> ${escHtml(created.npWarehouseName)}` +
        `\n<b>Клієнт:</b> ${escHtml(created.customerName)} ${escHtml(
          created.customerSurname,
        )} ${escHtml(created.customerPatronymic ?? '')}` +
        `\n<b>Телефон:</b> ${escHtml(created.customerPhone)}` +
        (created.customerEmail
          ? `\n<b>Email:</b> ${escHtml(created.customerEmail)}`
          : '') +
        `\n\n<b>Товари:</b>\n${itemsText}`

      console.info('Telegram: sending order notification', created.id)
      // Best-effort: attempt send, but never fail the order request
      await sendTelegram(msg)
    } catch (e) {
      console.error(
        'Telegram: failed to send order notification (non-blocking):',
        e,
      )
    }

    return NextResponse.json(
      { orderId: created.id, orderNumber: created.shortNumber },
      { status: 201 },
    )
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('Create order error:', err.message)
    } else {
      console.error('Create order error:', err)
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}
