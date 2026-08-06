// Pure builders for customer-facing order emails. No prisma, no transport —
// everything here is deterministic so it can be unit tested and previewed.

export type OrderEmailLocale = 'uk' | 'en'

// PAID            — money is in, the order is confirmed.
// AWAITING_PAYMENT — bank transfer: the customer still owes us the payment,
//                    so the email carries the payment details.
export type OrderEmailKind = 'PAID' | 'AWAITING_PAYMENT'

export type OrderEmailAddon = {
  name?: string | null
  qty?: number | null
}

export type OrderEmailItem = {
  name: string
  color?: string | null
  modelSize?: string | null
  pouchColor?: string | null
  strapName?: string | null
  priceUAH: number
  qty: number
  addons?: unknown
}

export type OrderEmailOrder = {
  shortNumber: number
  subtotalUAH: number
  discountUAH: number
  deliveryUAH: number
  totalUAH: number
  paymentMethod: string
  shippingMethod?: string | null
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
  items: OrderEmailItem[]
}

const BRAND = 'GERDAN'

// The order has no persisted locale yet, so we infer it the same way checkout
// already picks a display currency: domestic (Nova Poshta) shoppers are on the
// Ukrainian site, international ones on the English one.
export function resolveOrderEmailLocale(
  order: Pick<OrderEmailOrder, 'shippingMethod'>,
): OrderEmailLocale {
  return String(order.shippingMethod ?? '').trim() === 'INTERNATIONAL_ADDRESS'
    ? 'en'
    : 'uk'
}

export function formatOrderAmount(value: number): string {
  const amount = Math.max(0, Math.round(Number(value) || 0))
  // Deterministic grouping — avoids depending on the runtime's ICU data.
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₴`
}

function escapeHtml(value: string): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function clean(value: string | null | undefined): string {
  return String(value ?? '').trim()
}

function t(locale: OrderEmailLocale, uk: string, en: string): string {
  return locale === 'en' ? en : uk
}

function readAddons(item: OrderEmailItem): OrderEmailAddon[] {
  return Array.isArray(item.addons) ? (item.addons as OrderEmailAddon[]) : []
}

// Human-readable option list for one line item ("колір: чорний · ремінець: …").
export function buildItemOptionParts(
  item: OrderEmailItem,
  locale: OrderEmailLocale,
): string[] {
  const parts: string[] = []

  if (clean(item.color)) {
    parts.push(`${t(locale, 'колір', 'colour')}: ${clean(item.color)}`)
  }
  if (clean(item.modelSize)) {
    parts.push(`${t(locale, 'розмір', 'size')}: ${clean(item.modelSize)}`)
  }
  if (clean(item.pouchColor)) {
    parts.push(`${t(locale, 'мішечок', 'pouch')}: ${clean(item.pouchColor)}`)
  }
  if (clean(item.strapName)) {
    parts.push(`${t(locale, 'ремінець', 'strap')}: ${clean(item.strapName)}`)
  }

  const addonNames = readAddons(item)
    .map((addon) => clean(addon?.name))
    .filter((name) => name.length > 0)

  if (addonNames.length) {
    parts.push(
      `${t(locale, 'додатково', 'add-ons')}: ${addonNames.join(', ')}`,
    )
  }

  return parts
}

export function buildShippingLines(
  order: OrderEmailOrder,
  locale: OrderEmailLocale,
): string[] {
  if (clean(order.shippingMethod) === 'INTERNATIONAL_ADDRESS') {
    const locality = [clean(order.shippingPostalCode), clean(order.shippingCity)]
      .filter((part) => part.length > 0)
      .join(' ')

    return [
      clean(order.shippingCountryName),
      clean(order.shippingRegion),
      locality,
      clean(order.shippingAddressLine1),
      clean(order.shippingAddressLine2),
    ].filter((line) => line.length > 0)
  }

  const warehouse = clean(order.npWarehouseName)
  return [
    t(locale, 'Нова пошта', 'Nova Poshta'),
    clean(order.npCityName),
    warehouse && warehouse.toUpperCase() !== 'НЕ ВКАЗАНО' ? warehouse : '',
  ].filter((line) => line.length > 0)
}

export function buildOrderEmailSubject(input: {
  order: Pick<OrderEmailOrder, 'shortNumber'>
  kind: OrderEmailKind
  locale: OrderEmailLocale
}): string {
  const number = `#${input.order.shortNumber}`

  if (input.kind === 'AWAITING_PAYMENT') {
    return t(
      input.locale,
      `Замовлення ${number} — реквізити для оплати · ${BRAND}`,
      `Order ${number} — payment details · ${BRAND}`,
    )
  }

  return t(
    input.locale,
    `Замовлення ${number} підтверджено · ${BRAND}`,
    `Order ${number} confirmed · ${BRAND}`,
  )
}

type TotalsRow = { label: string; value: string; strong?: boolean }

function buildTotalsRows(
  order: OrderEmailOrder,
  locale: OrderEmailLocale,
): TotalsRow[] {
  const rows: TotalsRow[] = [
    {
      label: t(locale, 'Сума', 'Subtotal'),
      value: formatOrderAmount(order.subtotalUAH),
    },
  ]

  if (Math.round(Number(order.discountUAH) || 0) > 0) {
    rows.push({
      label: t(locale, 'Знижка', 'Discount'),
      value: `−${formatOrderAmount(order.discountUAH)}`,
    })
  }

  rows.push({
    label: t(locale, 'Доставка', 'Shipping'),
    value:
      Math.round(Number(order.deliveryUAH) || 0) > 0
        ? formatOrderAmount(order.deliveryUAH)
        : t(locale, 'за тарифами перевізника', "at the carrier's rates"),
  })

  rows.push({
    label: t(locale, 'До сплати', 'Total'),
    value: formatOrderAmount(order.totalUAH),
    strong: true,
  })

  return rows
}

function buildIntroLines(
  order: OrderEmailOrder,
  kind: OrderEmailKind,
  locale: OrderEmailLocale,
): string[] {
  const name = clean(order.customerName)
  const greeting = name
    ? t(locale, `Вітаємо, ${name}!`, `Hello ${name},`)
    : t(locale, 'Вітаємо!', 'Hello,')

  if (kind === 'AWAITING_PAYMENT') {
    return [
      greeting,
      t(
        locale,
        `Дякуємо за замовлення #${order.shortNumber}. Ми зберігаємо його за вами й чекаємо на оплату — реквізити нижче.`,
        `Thank you for order #${order.shortNumber}. We are holding it for you and are waiting for payment — details are below.`,
      ),
    ]
  }

  return [
    greeting,
    t(
      locale,
      `Дякуємо! Оплату отримано, замовлення #${order.shortNumber} підтверджено — ми вже беремо його в роботу.`,
      `Thank you! Your payment was received and order #${order.shortNumber} is confirmed — we are getting to work on it.`,
    ),
  ]
}

// The configured bank details are static text and cannot know the order number,
// but the merchant needs it in the transfer reference to match an incoming
// payment to an order. So the template always adds it itself.
export function buildPaymentReference(
  order: Pick<OrderEmailOrder, 'shortNumber'>,
  locale: OrderEmailLocale,
): string {
  return t(
    locale,
    `Призначення платежу: Замовлення #${order.shortNumber}`,
    `Payment reference: Order #${order.shortNumber}`,
  )
}

function buildNextStepsLine(
  kind: OrderEmailKind,
  locale: OrderEmailLocale,
): string {
  if (kind === 'AWAITING_PAYMENT') {
    return t(
      locale,
      'Щойно кошти надійдуть, ми одразу візьмемо замовлення в роботу й повідомимо вас.',
      'As soon as the payment arrives we will start working on your order and let you know.',
    )
  }

  return t(
    locale,
    'Щойно передамо посилку Новій пошті — надішлемо номер накладної для відстеження.',
    'Once the parcel is handed to the carrier we will send you the tracking number.',
  )
}

// International orders are quoted in USD at checkout but the order itself is
// stored only in UAH, so we state the UAH amount and promise an exact figure
// rather than inventing an exchange rate.
function buildCurrencyNote(
  order: OrderEmailOrder,
  locale: OrderEmailLocale,
): string | null {
  if (clean(order.shippingMethod) !== 'INTERNATIONAL_ADDRESS') return null

  return t(
    locale,
    'Суму вказано в гривні. Точну суму в USD ми підтвердимо разом із реквізитами.',
    'The amount is shown in UAH. We will confirm the exact USD amount together with the payment details.',
  )
}

export function buildOrderEmailText(input: {
  order: OrderEmailOrder
  kind: OrderEmailKind
  locale: OrderEmailLocale
  bankTransferDetails?: string | null
  siteUrl: string
}): string {
  const { order, kind, locale } = input
  const lines: string[] = []

  lines.push(...buildIntroLines(order, kind, locale), '')

  lines.push(t(locale, 'ВАШЕ ЗАМОВЛЕННЯ', 'YOUR ORDER'))
  for (const item of order.items) {
    const options = buildItemOptionParts(item, locale)
    lines.push(
      `- ${item.name}${options.length ? ` (${options.join(' · ')})` : ''} × ${item.qty} — ${formatOrderAmount(item.priceUAH * item.qty)}`,
    )
  }
  lines.push('')

  for (const row of buildTotalsRows(order, locale)) {
    lines.push(`${row.label}: ${row.value}`)
  }

  const currencyNote = buildCurrencyNote(order, locale)
  if (currencyNote) lines.push('', currencyNote)

  lines.push('', t(locale, 'ДОСТАВКА', 'DELIVERY'))
  lines.push(...buildShippingLines(order, locale))

  const details = clean(input.bankTransferDetails)
  if (kind === 'AWAITING_PAYMENT') {
    lines.push('', t(locale, 'РЕКВІЗИТИ ДЛЯ ОПЛАТИ', 'PAYMENT DETAILS'))
    if (details) {
      lines.push(details, buildPaymentReference(order, locale))
    } else {
      lines.push(
        t(
          locale,
          'Ми надішлемо реквізити окремим повідомленням найближчим часом.',
          'We will send the payment details in a separate message shortly.',
        ),
      )
    }
  }

  lines.push('', buildNextStepsLine(kind, locale))
  lines.push(
    '',
    t(
      locale,
      `Питання? Просто відповідайте на цей лист. ${input.siteUrl}`,
      `Questions? Just reply to this email. ${input.siteUrl}`,
    ),
    BRAND,
  )

  return lines.join('\n')
}

export function buildOrderEmailHtml(input: {
  order: OrderEmailOrder
  kind: OrderEmailKind
  locale: OrderEmailLocale
  bankTransferDetails?: string | null
  siteUrl: string
}): string {
  const { order, kind, locale } = input
  const text = (value: string) => escapeHtml(value)

  const itemRows = order.items
    .map((item) => {
      const options = buildItemOptionParts(item, locale)
      const optionsHtml = options.length
        ? `<div style="color:#6b7280;font-size:13px;line-height:1.5;margin-top:4px;">${text(options.join(' · '))}</div>`
        : ''

      return `<tr>
  <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
    <div style="color:#111827;font-size:15px;font-weight:600;">${text(item.name)}</div>
    ${optionsHtml}
    <div style="color:#6b7280;font-size:13px;margin-top:4px;">× ${text(String(item.qty))}</div>
  </td>
  <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;color:#111827;font-size:15px;white-space:nowrap;vertical-align:top;">
    ${text(formatOrderAmount(item.priceUAH * item.qty))}
  </td>
</tr>`
    })
    .join('')

  const totalsRows = buildTotalsRows(order, locale)
    .map((row) => {
      const weight = row.strong ? '600' : '400'
      const color = row.strong ? '#111827' : '#6b7280'
      const size = row.strong ? '16px' : '14px'
      const border = row.strong ? 'border-top:1px solid #e5e7eb;' : ''

      return `<tr>
  <td style="padding:6px 0;${border}color:${color};font-size:${size};font-weight:${weight};">${text(row.label)}</td>
  <td style="padding:6px 0;${border}color:${color};font-size:${size};font-weight:${weight};text-align:right;white-space:nowrap;">${text(row.value)}</td>
</tr>`
    })
    .join('')

  const shippingHtml = buildShippingLines(order, locale)
    .map((line) => `<div>${text(line)}</div>`)
    .join('')

  const currencyNote = buildCurrencyNote(order, locale)
  const currencyNoteHtml = currencyNote
    ? `<p style="color:#6b7280;font-size:13px;line-height:1.6;margin:12px 0 0;">${text(currencyNote)}</p>`
    : ''

  const details = clean(input.bankTransferDetails)
  const paymentReferenceHtml = details
    ? `<div style="color:#111827;font-size:14px;line-height:1.7;font-weight:600;margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;">${text(
        buildPaymentReference(order, locale),
      )}</div>`
    : ''
  const paymentBlock =
    kind === 'AWAITING_PAYMENT'
      ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:24px 0;">
  <div style="color:#111827;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">${text(
    t(locale, 'Реквізити для оплати', 'Payment details'),
  )}</div>
  <div style="color:#374151;font-size:14px;line-height:1.7;white-space:pre-wrap;">${text(
    details ||
      t(
        locale,
        'Ми надішлемо реквізити окремим повідомленням найближчим часом.',
        'We will send the payment details in a separate message shortly.',
      ),
  )}</div>
  ${paymentReferenceHtml}
</div>`
      : ''

  const introHtml = buildIntroLines(order, kind, locale)
    .map(
      (line) =>
        `<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 12px;">${text(line)}</p>`,
    )
    .join('')

  const sectionTitle = (value: string) =>
    `<div style="color:#111827;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin:28px 0 10px;">${text(value)}</div>`

  return `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<tr><td>

<div style="color:#111827;font-size:22px;letter-spacing:0.35em;text-align:center;margin-bottom:28px;">${BRAND}</div>

${introHtml}

${sectionTitle(t(locale, 'Ваше замовлення', 'Your order'))}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows}</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">${totalsRows}</table>
${currencyNoteHtml}

${paymentBlock}

${sectionTitle(t(locale, 'Доставка', 'Delivery'))}
<div style="color:#374151;font-size:14px;line-height:1.7;">${shippingHtml}</div>

<p style="color:#374151;font-size:14px;line-height:1.7;margin:28px 0 0;">${text(
    buildNextStepsLine(kind, locale),
  )}</p>

<p style="color:#6b7280;font-size:13px;line-height:1.7;margin:24px 0 0;border-top:1px solid #e5e7eb;padding-top:20px;">
${text(t(locale, 'Питання? Просто відповідайте на цей лист.', 'Questions? Just reply to this email.'))}<br>
<a href="${text(input.siteUrl)}" style="color:#111827;">${text(input.siteUrl.replace(/^https?:\/\//, ''))}</a>
</p>

</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export function buildOrderEmail(input: {
  order: OrderEmailOrder
  kind: OrderEmailKind
  locale: OrderEmailLocale
  bankTransferDetails?: string | null
  siteUrl: string
}): { subject: string; html: string; text: string } {
  return {
    subject: buildOrderEmailSubject(input),
    html: buildOrderEmailHtml(input),
    text: buildOrderEmailText(input),
  }
}
