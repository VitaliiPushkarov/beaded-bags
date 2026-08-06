import { calcDiscountedPrice } from '@/lib/pricing'

// Server-side repricing for checkout.
//
// The cart lives in the browser, so every price it submits is attacker
// controlled and also simply stale — a cart can sit in localStorage for months.
// Nothing may be trusted from the client except *which* things were chosen
// (variant + strap/size/pouch ids) and how many. The money is recomputed here
// from the catalogue, using the same calcDiscountedPrice the product page uses
// so a correct cart reprices to exactly the number the shopper saw.

export type RepriceLineInput = {
  name: string
  variantId?: string | null
  strapId?: string | null
  sizeId?: string | null
  pouchId?: string | null
  qty: number
  priceUAH: number
}

export type RepriceCatalogVariant = {
  id: string
  priceUAH: number | null
  discountPercent: number | null
  discountUAH: number | null
  productBasePriceUAH: number | null
  // Option id -> surcharge, restricted to options that belong to this variant.
  strapExtraById: Map<string, number>
  sizeExtraById: Map<string, number>
  pouchExtraById: Map<string, number>
}

export type RepriceIssue =
  | { code: 'UNKNOWN_VARIANT'; index: number; name: string }
  | {
      code: 'UNKNOWN_OPTION'
      index: number
      name: string
      option: 'strap' | 'size' | 'pouch'
    }
  | {
      code: 'PRICE_CHANGED'
      index: number
      name: string
      submittedUAH: number
      actualUAH: number
    }

export type RepricedLine = {
  index: number
  unitPriceUAH: number
  lineTotalUAH: number
}

export type RepriceResult = {
  lines: RepricedLine[]
  subtotalUAH: number
  issues: RepriceIssue[]
}

function normalizeExtra(value: number | null | undefined): number {
  const raw = Number(value ?? 0)
  if (!Number.isFinite(raw)) return 0
  return Math.max(0, Math.round(raw))
}

function normalizeQty(value: number): number {
  const raw = Number(value)
  if (!Number.isFinite(raw)) return 0
  return Math.max(0, Math.trunc(raw))
}

// Mirrors the product page: discounted variant price plus the surcharges of the
// selected options. Exported so the arithmetic can be tested on its own.
export function computeVariantUnitPriceUAH(input: {
  variant: Pick<
    RepriceCatalogVariant,
    'priceUAH' | 'discountPercent' | 'discountUAH' | 'productBasePriceUAH'
  >
  extras?: Array<number | null | undefined>
}): number {
  const { finalPriceUAH } = calcDiscountedPrice({
    basePriceUAH: input.variant.priceUAH ?? input.variant.productBasePriceUAH ?? 0,
    discountPercent: input.variant.discountPercent,
    discountUAH: input.variant.discountUAH ?? 0,
  })

  const extrasTotal = (input.extras ?? []).reduce<number>(
    (sum, extra) => sum + normalizeExtra(extra),
    0,
  )

  return finalPriceUAH + extrasTotal
}

// Look up an option surcharge, distinguishing "not chosen" from "does not
// belong to this variant". A foreign option id is rejected rather than ignored:
// silently dropping it would change what the shopper ordered.
function resolveOptionExtra(
  optionId: string | null | undefined,
  extraById: Map<string, number>,
): { ok: true; extra: number } | { ok: false } {
  const id = String(optionId ?? '').trim()
  if (!id) return { ok: true, extra: 0 }

  const extra = extraById.get(id)
  if (extra === undefined) return { ok: false }

  return { ok: true, extra }
}

export function repriceOrderLines(
  lines: RepriceLineInput[],
  catalog: Map<string, RepriceCatalogVariant>,
): RepriceResult {
  const repriced: RepricedLine[] = []
  const issues: RepriceIssue[] = []
  let subtotalUAH = 0

  lines.forEach((line, index) => {
    const variantId = String(line.variantId ?? '').trim()
    const variant = variantId ? catalog.get(variantId) : undefined

    // No variant means there is nothing to price against — the line cannot be
    // verified, so it is refused rather than trusted.
    if (!variant) {
      issues.push({ code: 'UNKNOWN_VARIANT', index, name: line.name })
      return
    }

    const strap = resolveOptionExtra(line.strapId, variant.strapExtraById)
    if (!strap.ok) {
      issues.push({
        code: 'UNKNOWN_OPTION',
        index,
        name: line.name,
        option: 'strap',
      })
      return
    }

    const size = resolveOptionExtra(line.sizeId, variant.sizeExtraById)
    if (!size.ok) {
      issues.push({
        code: 'UNKNOWN_OPTION',
        index,
        name: line.name,
        option: 'size',
      })
      return
    }

    const pouch = resolveOptionExtra(line.pouchId, variant.pouchExtraById)
    if (!pouch.ok) {
      issues.push({
        code: 'UNKNOWN_OPTION',
        index,
        name: line.name,
        option: 'pouch',
      })
      return
    }

    const unitPriceUAH = computeVariantUnitPriceUAH({
      variant,
      extras: [size.extra, pouch.extra, strap.extra],
    })

    const submittedUAH = Math.round(Number(line.priceUAH) || 0)
    if (submittedUAH !== unitPriceUAH) {
      issues.push({
        code: 'PRICE_CHANGED',
        index,
        name: line.name,
        submittedUAH,
        actualUAH: unitPriceUAH,
      })
      return
    }

    const lineTotalUAH = unitPriceUAH * normalizeQty(line.qty)
    subtotalUAH += lineTotalUAH
    repriced.push({ index, unitPriceUAH, lineTotalUAH })
  })

  return { lines: repriced, subtotalUAH, issues }
}
