export type PreorderItemInput = {
  productId: string
  productSlug?: string | null
  productName: string
  variantId: string
  variantLabel?: string | null
  variantColor?: string | null
  modelSize?: string | null
  pouchColor?: string | null
  strapId?: string | null
  strapName?: string | null
  priceUAH?: number | null
  qty?: number | null
  image?: string | null
  kind?: 'main' | 'addon'
}

export const UA_PHONE_MASK = '+{380} 00 000 00 00'
export const UA_PHONE_PATTERN = '^\\+380 \\d{2} \\d{3} \\d{2} \\d{2}$'
export const UA_PHONE_PLACEHOLDER = '+380 XX XXX XX XX'
export const UA_PHONE_DEFAULT_PREFIX = '+380 '

export type PreorderItem = {
  productId: string
  productSlug: string | null
  productName: string
  variantId: string
  variantLabel: string | null
  variantColor: string | null
  modelSize: string | null
  pouchColor: string | null
  strapId: string | null
  strapName: string | null
  priceUAH: number | null
  qty: number
  image: string | null
  kind: 'main' | 'addon'
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function toNullableString(value: unknown) {
  const cleaned = cleanString(value)
  return cleaned || null
}

function toNullableMoney(value: unknown) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount)
}

function normalizePreorderItem(value: unknown): PreorderItem | null {
  if (!value || typeof value !== 'object') return null

  const item = value as Record<string, unknown>
  const productId = cleanString(item.productId)
  const productName = cleanString(item.productName)
  const variantId = cleanString(item.variantId)

  if (!productId || !productName || !variantId) return null

  const qty = Math.max(1, Math.trunc(Number(item.qty) || 1))
  const kind = cleanString(item.kind) === 'addon' ? 'addon' : 'main'

  return {
    productId,
    productSlug: toNullableString(item.productSlug),
    productName,
    variantId,
    variantLabel: toNullableString(item.variantLabel),
    variantColor: toNullableString(item.variantColor),
    modelSize: toNullableString(item.modelSize),
    pouchColor: toNullableString(item.pouchColor),
    strapId: toNullableString(item.strapId),
    strapName: toNullableString(item.strapName),
    priceUAH: toNullableMoney(item.priceUAH),
    qty,
    image: toNullableString(item.image),
    kind,
  }
}

function formatUAH(value: number) {
  return `${Math.round(value)} ₴`
}

export function normalizeUaPhone(value: unknown) {
  let digits = String(value ?? '').replace(/\D/g, '')

  if (digits.startsWith('80')) {
    digits = `3${digits}`
  } else if (digits.startsWith('0')) {
    digits = `380${digits.slice(1)}`
  } else if (!digits.startsWith('380') && digits.length <= 9) {
    digits = `380${digits}`
  }

  if (digits.length > 12) {
    digits = digits.slice(0, 12)
  }

  return digits
}

export function isUaPhoneValid(value: unknown) {
  const digits = normalizeUaPhone(value)
  return /^380\d{9}$/.test(digits)
}

export function formatUaPhone(value: unknown) {
  const digits = normalizeUaPhone(value)

  if (!isUaPhoneValid(digits)) {
    return String(value ?? '').trim()
  }

  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(
    5,
    8,
  )} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`
}

function escHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function buildPreorderItemLabel(item: PreorderItem) {
  const explicitLabel = cleanString(item.variantLabel)
  if (explicitLabel) return explicitLabel

  const detailParts = [
    cleanString(item.variantColor),
    cleanString(item.modelSize)
      ? `Розмір: ${cleanString(item.modelSize)}`
      : null,
    cleanString(item.pouchColor)
      ? `Мішечок: ${cleanString(item.pouchColor)}`
      : null,
  ].filter((part): part is string => Boolean(part))

  return detailParts.length
    ? `${item.productName} — ${detailParts.join(' · ')}`
    : item.productName
}

export function normalizePreorderItems(items: unknown): PreorderItem[] {
  if (!Array.isArray(items)) return []

  return items
    .map((item) => normalizePreorderItem(item))
    .filter((item): item is PreorderItem => Boolean(item))
}

export function buildFallbackPreorderItems(
  item: Omit<PreorderItemInput, 'qty' | 'kind'> & {
    qty?: number | null
    kind?: 'main' | 'addon'
  },
): PreorderItem[] {
  return normalizePreorderItems([
    {
      ...item,
      qty: item.qty ?? 1,
      kind: item.kind ?? 'main',
    },
  ])
}

export function buildPreorderItemsText(items: PreorderItem[]) {
  return items
    .map((item) => {
      const label = buildPreorderItemLabel(item)
      const title = item.kind === 'addon' ? `Доповнення: ${label}` : label
      const summary =
        `• ${title} × ${item.qty}` +
        (item.priceUAH != null ? ` — ${formatUAH(item.priceUAH)}` : '')
      const extraLines = item.strapName
        ? [`  ↳ ремінець: ${item.strapName}`]
        : []

      return [summary, ...extraLines].join('\n')
    })
    .join('\n')
}

export function buildPreorderTelegramMessage(params: {
  leadId: string
  items: PreorderItem[]
  contact: string
  contactName?: string | null
  comment?: string | null
  url?: string | null
}) {
  const itemsText = buildPreorderItemsText(params.items)
  const hasCompletePricing =
    params.items.length > 0 &&
    params.items.every((item) => item.priceUAH != null)
  const totalUAH = hasCompletePricing
    ? params.items.reduce(
        (sum, item) => sum + Math.round((item.priceUAH ?? 0) * item.qty),
        0,
      )
    : 0

  return (
    `🧾 <b>Нове передзамовлення</b>\n` +
    `\n<b>Контакт:</b> ${escHtml(params.contact)}` +
    (params.contactName
      ? `\n<b>Ім’я:</b> ${escHtml(params.contactName)}`
      : '') +
    (params.comment ? `\n<b>Коментар:</b> ${escHtml(params.comment)}` : '') +
    (params.url ? `\n<b>URL:</b> ${escHtml(params.url)}` : '') +
    `\n\n<b>Товари:</b>\n${escHtml(itemsText)}` +
    (hasCompletePricing
      ? `\n\n<b>Орієнтовна сума:</b> ${escHtml(formatUAH(totalUAH))}`
      : '') +
    `\n\n<b>Lead ID:</b> ${escHtml(params.leadId)}`
  )
}

export function buildPreorderMailtoBody(params: {
  items: PreorderItem[]
  pageUrl?: string | null
  contactName?: string | null
  contact: string
  comment?: string | null
}) {
  const lines = [
    'Хочу передзамовити товар.',
    '',
    'Товари:',
    buildPreorderItemsText(params.items),
  ]

  if (params.pageUrl) {
    lines.push('', `Сторінка: ${params.pageUrl}`)
  }

  lines.push('')

  if (params.contactName) {
    lines.push(`Ім'я: ${params.contactName}`)
  }

  lines.push(`Телефон: ${params.contact}`)

  if (params.comment) {
    lines.push(`Коментар: ${params.comment}`)
  }

  return lines.join('\n')
}
