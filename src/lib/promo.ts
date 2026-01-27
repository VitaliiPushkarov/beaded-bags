export const PROMO_CODE = 'GERDAN10'
export const PROMO_STORAGE_KEY = 'gerdan_promo_code'
export const DISCOUNT_PCT = 10 as const

export function readPromoFromStorage(): string | null {
  try {
    return window.localStorage.getItem(PROMO_STORAGE_KEY)
  } catch {
    return null
  }
}

export function isPromoApplied(code: string | null) {
  return code?.trim().toUpperCase() === PROMO_CODE
}

export function calcDiscountUAH(subtotalUAH: number, applied: boolean) {
  if (!applied) return 0
  return Math.round((subtotalUAH * DISCOUNT_PCT) / 100)
}

export function emitPromoChanged() {
  window.dispatchEvent(new Event('gerdan_promo_changed'))
}
