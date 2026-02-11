export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

type DiscountInput = {
  basePriceUAH: number | null | undefined
  discountPercent?: number | null
  // Legacy field, previously stored as fixed UAH.
  discountUAH?: number | null
}

export function resolveDiscountPercent(input: DiscountInput): number {
  const base = Math.max(0, Number(input.basePriceUAH ?? 0))

  const explicitPercent = Number(input.discountPercent ?? 0)
  if (Number.isFinite(explicitPercent) && explicitPercent > 0) {
    return clampPercent(explicitPercent)
  }

  const legacyRaw = Number(input.discountUAH ?? 0)
  if (!Number.isFinite(legacyRaw) || legacyRaw <= 0) return 0

  // Backward compatibility:
  // - values in [1..100] are treated as percent
  // - bigger values are treated as old fixed UAH and converted to percent
  if (legacyRaw <= 100) {
    return clampPercent(legacyRaw)
  }

  if (base <= 0) return 0

  return clampPercent((legacyRaw / base) * 100)
}

export function calcDiscountedPrice(input: DiscountInput): {
  basePriceUAH: number
  discountPercent: number
  discountUAH: number
  finalPriceUAH: number
  hasDiscount: boolean
} {
  const basePriceUAH = Math.max(0, Number(input.basePriceUAH ?? 0))
  const discountPercent = resolveDiscountPercent({
    basePriceUAH,
    discountPercent: input.discountPercent,
    discountUAH: input.discountUAH,
  })

  const discountUAH = Math.round((basePriceUAH * discountPercent) / 100)
  const finalPriceUAH = Math.max(0, basePriceUAH - discountUAH)
  const hasDiscount = discountPercent > 0 && finalPriceUAH < basePriceUAH

  return {
    basePriceUAH,
    discountPercent,
    discountUAH,
    finalPriceUAH,
    hasDiscount,
  }
}
