// Client-side promo storage only. Codes are no longer known to the front end —
// they live in the PromoCode table and are validated by /api/promo/validate,
// with the order route re-checking them against the repriced subtotal.

export const PROMO_STORAGE_KEY = 'gerdan_promo_code'
export const PROMO_CHANGED_EVENT = 'gerdan_promo_changed'

export function normalizePromoInput(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
}

export function readPromoFromStorage(): string | null {
  try {
    const stored = window.localStorage.getItem(PROMO_STORAGE_KEY)
    return stored ? normalizePromoInput(stored) || null : null
  } catch {
    return null
  }
}

export function writePromoToStorage(code: string | null) {
  try {
    if (code) {
      window.localStorage.setItem(PROMO_STORAGE_KEY, normalizePromoInput(code))
    } else {
      window.localStorage.removeItem(PROMO_STORAGE_KEY)
    }
  } catch {}
}

export function emitPromoChanged() {
  window.dispatchEvent(new Event(PROMO_CHANGED_EVENT))
}

export type PromoValidationResponse =
  | {
      valid: true
      code: string
      discountPercent: number
      discountUAH: number
    }
  | { valid: false; reason?: string; message?: string }

export async function validatePromoCode(input: {
  code: string
  subtotalUAH: number
  locale: 'uk' | 'en'
  signal?: AbortSignal
}): Promise<PromoValidationResponse> {
  const res = await fetch('/api/promo/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: input.code,
      subtotalUAH: input.subtotalUAH,
      locale: input.locale,
    }),
    signal: input.signal,
  })

  if (!res.ok) return { valid: false }
  return (await res.json()) as PromoValidationResponse
}
