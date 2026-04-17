import type { Locale } from '@/lib/locale'
import { resolveDiscountPercent } from '@/lib/pricing'

export type MoneyCurrency = 'UAH' | 'USD'

type PickLocalizedMoneyInput = {
  locale: Locale
  priceUAH?: number | null
  priceUSD?: number | null
}

type CalcLocalizedDiscountInput = PickLocalizedMoneyInput & {
  discountPercent?: number | null
  discountUAH?: number | null
}

function normalizeMoneyAmount(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.round(value))
}

export function pickLocalizedText(
  ukText: string | null | undefined,
  enText: string | null | undefined,
  locale: Locale,
): string {
  const uk = (ukText || '').trim()
  const en = (enText || '').trim()

  if (locale === 'en') return en || uk
  return uk || en
}

export function pickLocalizedMoney(input: PickLocalizedMoneyInput): {
  amount: number
  currency: MoneyCurrency
} {
  const amountUAH = normalizeMoneyAmount(input.priceUAH)
  const amountUSD = normalizeMoneyAmount(input.priceUSD)

  if (input.locale === 'en' && amountUSD != null) {
    return { amount: amountUSD, currency: 'USD' }
  }

  if (amountUAH != null) {
    return { amount: amountUAH, currency: 'UAH' }
  }

  if (amountUSD != null) {
    return { amount: amountUSD, currency: 'USD' }
  }

  return {
    amount: 0,
    currency: input.locale === 'en' ? 'USD' : 'UAH',
  }
}

export function formatLocalizedMoney(
  amount: number,
  currency: MoneyCurrency,
  numberLocale: string,
): string {
  const safeAmount = normalizeMoneyAmount(amount) ?? 0
  const formatted = safeAmount.toLocaleString(numberLocale)

  if (currency === 'USD') return `$${formatted}`
  return `${formatted} ₴`
}

export function calcLocalizedDiscountedPrice(input: CalcLocalizedDiscountInput): {
  basePrice: number
  finalPrice: number
  discountPercent: number
  hasDiscount: boolean
  discountAmount: number
  currency: MoneyCurrency
} {
  const localized = pickLocalizedMoney(input)
  const basePrice = localized.amount
  const discountPercent = resolveDiscountPercent({
    basePriceUAH:
      normalizeMoneyAmount(input.priceUAH) ?? normalizeMoneyAmount(basePrice) ?? 0,
    discountPercent: input.discountPercent,
    discountUAH: input.discountUAH,
  })

  const discountAmount = Math.round((basePrice * discountPercent) / 100)
  const finalPrice = Math.max(0, basePrice - discountAmount)
  const hasDiscount = discountPercent > 0 && finalPrice < basePrice

  return {
    basePrice,
    finalPrice,
    discountPercent,
    hasDiscount,
    discountAmount,
    currency: localized.currency,
  }
}
