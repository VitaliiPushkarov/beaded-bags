import { prisma } from '@/lib/prisma'
import { formatCustomerFullName } from '@/lib/orders/customer'
import { getOrderShippingDetails } from '@/lib/orders/shipping'
import { toAbsoluteUrl } from '@/lib/site-url'

const TELEGRAM_TIMEOUT_MS = 5000
const TELEGRAM_MEDIA_GROUP_LIMIT = 10

type TelegramMessageResult = {
  message_id: number
}

type TelegramMediaGroupItem = {
  type: 'photo'
  media: string
  caption?: string
  parse_mode?: 'HTML'
}

type TelegramOrderItem = {
  name: string
  color: string | null
  modelSize: string | null
  pouchColor: string | null
  strapName: string | null
  priceUAH: number
  qty: number
  image: string | null
  addons?: unknown
}

type TelegramOrder = {
  id: string
  shortNumber: number
  totalUAH: number
  paymentMethod: string
  shippingMethod?: string | null
  shippingCountryCode?: string | null
  shippingCountryName?: string | null
  shippingRegion?: string | null
  shippingCity?: string | null
  shippingPostalCode?: string | null
  shippingAddressLine1?: string | null
  shippingAddressLine2?: string | null
  npCityName?: string | null
  npWarehouseName?: string | null
  customerName: string
  customerSurname: string
  customerPatronymic: string | null
  customerPhone: string
  customerEmail: string | null
  items: TelegramOrderItem[]
}

async function callTelegramApi<T>(
  method: string,
  payload: Record<string, unknown>,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    console.warn(
      'Telegram is not configured: missing TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID',
    )
    return null
  }

  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS)

    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        ...payload,
      }),
      signal: controller.signal,
    })

    clearTimeout(t)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`Telegram ${method} failed:`, res.status, body)
      return null
    }

    const json = (await res.json().catch(() => null)) as {
      ok?: boolean
      result?: T
      description?: string
    } | null

    if (!json?.ok || !json.result) {
      console.error(`Telegram ${method} invalid response:`, json)
      return null
    }

    console.info(`Telegram ${method} ok`)
    return json.result
  } catch (error) {
    console.error(`Telegram ${method} error:`, error)
    return null
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

function buildOrderItemsText(order: TelegramOrder) {
  return order.items
    .map((item) => {
      const addonsText = Array.isArray((item as { addons?: unknown }).addons)
        ? ((item as { addons?: Array<{ name?: string | null }> }).addons ?? [])
            .map((addon) => addon?.name)
            .filter(Boolean)
            .join(', ')
        : ''

      const line =
        `• ${item.name}` +
        (item.color ? ` — ${item.color}` : '') +
        (item.modelSize ? `\n  ↳ розмір моделі: ${item.modelSize}` : '') +
        (item.pouchColor ? `\n  ↳ мішечок: ${item.pouchColor}` : '') +
        (item.strapName ? `\n  ↳ ремінець: ${item.strapName}` : '') +
        (addonsText ? `\n  ↳ додатково: ${addonsText}` : '') +
        ` × ${item.qty} — ${formatUAH(item.priceUAH)}`

      return escHtml(line)
    })
    .join('\n')
}

export function buildOrderTelegramMessage(order: TelegramOrder) {
  const itemsText = buildOrderItemsText(order)
  const shipping = getOrderShippingDetails(order)
  const shippingText = shipping.fields
    .map((field) => `\n<b>${escHtml(field.label)}:</b> ${escHtml(field.value)}`)
    .join('')

  return (
    `🛍 <b>Нове замовлення</b>\n` +
    `\n<b>Номер:</b> ${escHtml(shortNumber(order.shortNumber))}` +
    `\n<b>Сума:</b> ${escHtml(formatUAH(order.totalUAH))}` +
    `\n<b>Оплата:</b> ${escHtml(paymentMethodName(order.paymentMethod))}\n` +
    `\n<b>Доставка:</b> ${escHtml(shipping.methodLabel)}` +
    shippingText +
    `\n<b>Клієнт:</b> ${escHtml(
      formatCustomerFullName({
        name: order.customerName,
        surname: order.customerSurname,
        patronymic: order.customerPatronymic,
      }),
    )}` +
    `\n<b>Телефон:</b> ${escHtml(order.customerPhone)}` +
    (order.customerEmail
      ? `\n<b>Email:</b> ${escHtml(order.customerEmail)}`
      : '') +
    `\n\n<b>Товари:</b>\n${itemsText}`
  )
}

export function resolveOrderTelegramPreviewImage(order: TelegramOrder) {
  return resolveOrderTelegramPreviewImages(order)[0] ?? null
}

export function resolveOrderTelegramPreviewImages(order: TelegramOrder) {
  const images = order.items
    .map((item) => String(item.image ?? '').trim())
    .filter((value) => value.length > 0)
    .map((value) => toAbsoluteUrl(value))

  return Array.from(new Set(images))
}

export function buildOrderTelegramPhotoCaption(order: TelegramOrder) {
  const firstItemName = order.items[0]?.name ?? 'Замовлення'
  const totalQty = order.items.reduce((sum, item) => sum + item.qty, 0)
  const customerName = formatCustomerFullName({
    name: order.customerName,
    surname: order.customerSurname,
    patronymic: order.customerPatronymic,
  })

  return (
    `🛍 <b>Нове замовлення #${escHtml(shortNumber(order.shortNumber))}</b>` +
    `\n${escHtml(firstItemName)} · ${escHtml(String(totalQty))} шт` +
    `\n${escHtml(formatUAH(order.totalUAH))}` +
    `\n${escHtml(customerName)}`
  )
}

export function buildOrderTelegramMediaGroups(order: TelegramOrder) {
  const images = resolveOrderTelegramPreviewImages(order)
  if (images.length === 0) return []

  const groups: TelegramMediaGroupItem[][] = []

  for (
    let index = 0;
    index < images.length;
    index += TELEGRAM_MEDIA_GROUP_LIMIT
  ) {
    groups.push(
      images
        .slice(index, index + TELEGRAM_MEDIA_GROUP_LIMIT)
        .map((media) => ({ type: 'photo', media })),
    )
  }

  if (groups[0]?.[0]) {
    groups[0][0] = {
      ...groups[0][0],
      caption: buildOrderTelegramPhotoCaption(order),
      parse_mode: 'HTML',
    }
  }

  return groups
}

async function sendTelegramMessage(
  text: string,
  options?: { replyToMessageId?: number },
) {
  const result = await callTelegramApi<TelegramMessageResult>('sendMessage', {
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_to_message_id: options?.replyToMessageId,
  })

  return result?.message_id ?? null
}

async function sendTelegramPhoto(photo: string, caption: string) {
  const result = await callTelegramApi<TelegramMessageResult>('sendPhoto', {
    photo,
    caption,
    parse_mode: 'HTML',
  })

  return result?.message_id ?? null
}

async function sendTelegramMediaGroups(groups: TelegramMediaGroupItem[][]) {
  let firstMessageId: number | null = null

  for (const media of groups) {
    const result = await callTelegramApi<TelegramMessageResult[]>(
      'sendMediaGroup',
      { media },
    )

    if (!result?.length) {
      return firstMessageId
    }

    if (!firstMessageId) {
      firstMessageId = result[0]?.message_id ?? null
    }
  }

  return firstMessageId
}

// A customer just failed to pay by card because an item has no LiqPay good ID.
// Without this the shop would never learn: the order sits unpaid and the buyer
// simply leaves. Never throws — alerting must not add a second failure on top
// of the one being reported.
export async function sendLiqPayFiscalAlert(args: {
  orderShortNumber: number
  itemLabel: string
  catalogCode: string
}) {
  try {
    await sendTelegramMessage(
      `⚠️ <b>Онлайн-оплату заблоковано</b>\n` +
        `\nЗамовлення <b>#${escHtml(String(args.orderShortNumber))}</b> не може бути оплачене карткою: ` +
        `у позиції немає LiqPay ID, тому фіскальний чек не створюється.\n` +
        `\n<b>Позиція:</b> ${escHtml(args.itemLabel)}` +
        `\n<b>Код каталогу:</b> ${escHtml(args.catalogCode)}\n` +
        `\nДодайте LiqPay ID у <b>/admin/liqpay</b> та звʼяжіться з клієнтом — ` +
        `замовлення вже створене й очікує на оплату.`,
    )
  } catch (error) {
    console.error('Telegram: fiscal alert failed (non-blocking):', error)
  }
}

// The fiscal lines did not add up to the amount about to be charged. Payment is
// refused rather than taken without a receipt, so this is the only trace the
// shop gets — it has to name the numbers, because the cause is in the discount
// arithmetic and not in any item's setup.
export async function sendLiqPayFiscalTotalAlert(args: {
  orderShortNumber: number
  fiscalTotalUAH: number
  expectedTotalUAH: number
}) {
  try {
    await sendTelegramMessage(
      `⚠️ <b>Онлайн-оплату заблоковано</b>\n` +
        `\nЗамовлення <b>#${escHtml(String(args.orderShortNumber))}</b>: сума фіскального чека ` +
        `не збігається із сумою до сплати, тому ПРРО відхилив би чек уже після списання коштів.\n` +
        `\n<b>Сума чека:</b> ${escHtml(String(args.fiscalTotalUAH))} грн` +
        `\n<b>До сплати:</b> ${escHtml(String(args.expectedTotalUAH))} грн\n` +
        `\nЗамовлення створене й очікує на оплату — звʼяжіться з клієнтом.`,
    )
  } catch (error) {
    console.error('Telegram: fiscal total alert failed (non-blocking):', error)
  }
}

// Payments went through but LiqPay issued no fiscal receipt for them. The money
// is already taken, so nothing can be undone automatically — the point is that
// the shop finds out the same day instead of at the next tax reconciliation.
// One message covers the whole batch: the useful signal is the list, and
// re-checks run often enough that per-order messages would just repeat.
export async function sendLiqPayFiscalReceiptAlert(args: {
  orders: Array<{ shortNumber: number; totalUAH: number }>
  errorDescription: string | null
}) {
  if (args.orders.length === 0) return

  try {
    const list = args.orders
      .map(
        (order) =>
          `• <b>#${escHtml(String(order.shortNumber))}</b> — ${escHtml(String(order.totalUAH))} грн`,
      )
      .join('\n')

    await sendTelegramMessage(
      `🧾 <b>Чек ПРРО не створено</b>\n` +
        `\nОплачено, але без фіскального чека — ${escHtml(String(args.orders.length))} замовл.:\n` +
        `${list}\n` +
        (args.errorDescription
          ? `\n<b>LiqPay:</b> ${escHtml(args.errorDescription)}\n`
          : '') +
        `\nПеревірте <b>/admin/liqpay</b> — ціни в каталозі ПРРО мають збігатися ` +
        `з тим, що списано, інакше чек не створюється.`,
    )
  } catch (error) {
    console.error('Telegram: fiscal receipt alert failed (non-blocking):', error)
  }
}

export async function sendOrderTelegramNotification(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
    },
  })

  if (!order) {
    console.warn('Telegram: order not found for notification', orderId)
    return
  }

  const message = buildOrderTelegramMessage(order)
  const previewImages = resolveOrderTelegramPreviewImages(order)

  console.info('Telegram: sending order notification', order.id)

  if (previewImages.length > 1) {
    const previewMessageId = await sendTelegramMediaGroups(
      buildOrderTelegramMediaGroups(order),
    )

    if (previewMessageId) {
      await sendTelegramMessage(message, { replyToMessageId: previewMessageId })
      return
    }
  }

  if (previewImages.length === 1) {
    const previewImage = previewImages[0]
    const previewCaption = buildOrderTelegramPhotoCaption(order)
    const previewMessageId = await sendTelegramPhoto(
      previewImage,
      previewCaption,
    )

    if (previewMessageId) {
      await sendTelegramMessage(message, { replyToMessageId: previewMessageId })
      return
    }
  }

  await sendTelegramMessage(message)
}
