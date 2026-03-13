export const PROMO_CODE = 'SPECIAL'
export const BONUS_PROMO_CODE = 'GERDAN10'
export const PROMO_STORAGE_KEY = 'gerdan_promo_code'
export const DISCOUNT_PCT = 10 as const
export const PROMO_CODES = [PROMO_CODE, BONUS_PROMO_CODE] as const

type PromoCode = (typeof PROMO_CODES)[number]

export function readPromoFromStorage(): string | null {
  try {
    return window.localStorage.getItem(PROMO_STORAGE_KEY)
  } catch {
    return null
  }
}

export function resolvePromoCode(code: string | null | undefined): PromoCode | null {
  const normalized = code?.trim().toUpperCase()
  if (!normalized) return null

  return (PROMO_CODES as readonly string[]).includes(normalized)
    ? (normalized as PromoCode)
    : null
}

export function isPromoApplied(code: string | null | undefined) {
  return resolvePromoCode(code) !== null
}

export function getPromoDiscountPct(code: string | null | undefined) {
  return isPromoApplied(code) ? DISCOUNT_PCT : 0
}

export function calcDiscountUAH(
  subtotalUAH: number,
  promoCode: string | null | undefined,
) {
  const discountPct = getPromoDiscountPct(promoCode)
  if (!discountPct) return 0
  return Math.round((subtotalUAH * discountPct) / 100)
}

export function emitPromoChanged() {
  window.dispatchEvent(new Event('gerdan_promo_changed'))
}
