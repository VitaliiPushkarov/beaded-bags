import { prisma } from '@/lib/prisma'
import { formatCustomerFullName } from '@/lib/orders/customer'

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
  } catch (error) {
    console.error('Telegram sendMessage error:', error)
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

  const itemsText = order.items
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

  const message =
    `🛍 <b>Нове замовлення</b>\n` +
    `\n<b>Номер:</b> ${escHtml(shortNumber(order.shortNumber))}` +
    `\n<b>Сума:</b> ${escHtml(formatUAH(order.totalUAH))}` +
    `\n<b>Оплата:</b> ${escHtml(paymentMethodName(order.paymentMethod))}\n` +
    `\n<b>Доставка:</b> Нова пошта` +
    `\n<b>Місто:</b> ${escHtml(order.npCityName)}` +
    `\n<b>Відділення:</b> ${escHtml(order.npWarehouseName)}` +
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

  console.info('Telegram: sending order notification', order.id)
  await sendTelegram(message)
}
