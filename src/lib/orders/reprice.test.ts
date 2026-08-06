import test from 'node:test'
import assert from 'node:assert/strict'

import {
  computeVariantUnitPriceUAH,
  repriceOrderLines,
  type RepriceCatalogVariant,
  type RepriceLineInput,
} from './reprice'

function buildVariant(
  overrides: Partial<RepriceCatalogVariant> = {},
): RepriceCatalogVariant {
  return {
    id: 'variant-1',
    priceUAH: 2000,
    discountPercent: null,
    discountUAH: null,
    productBasePriceUAH: null,
    strapExtraById: new Map(),
    sizeExtraById: new Map(),
    pouchExtraById: new Map(),
    ...overrides,
  }
}

function buildLine(overrides: Partial<RepriceLineInput> = {}): RepriceLineInput {
  return {
    name: 'Сумка',
    variantId: 'variant-1',
    qty: 1,
    priceUAH: 2000,
    ...overrides,
  }
}

function catalogOf(...variants: RepriceCatalogVariant[]) {
  return new Map(variants.map((variant) => [variant.id, variant]))
}

test('an undiscounted variant prices at its own price', () => {
  assert.equal(
    computeVariantUnitPriceUAH({ variant: buildVariant() }),
    2000,
  )
})

test('a variant with no price of its own falls back to the product base price', () => {
  assert.equal(
    computeVariantUnitPriceUAH({
      variant: buildVariant({ priceUAH: null, productBasePriceUAH: 1500 }),
    }),
    1500,
  )
})

test('percentage discounts are applied', () => {
  assert.equal(
    computeVariantUnitPriceUAH({
      variant: buildVariant({ priceUAH: 2000, discountPercent: 15 }),
    }),
    1700,
  )
})

test('the legacy fixed-UAH discount is honoured the same way the storefront does', () => {
  // Values above 100 are legacy absolute amounts, converted to a percentage.
  assert.equal(
    computeVariantUnitPriceUAH({
      variant: buildVariant({ priceUAH: 2000, discountUAH: 500 }),
    }),
    1500,
  )
  // Values at or below 100 are already percentages.
  assert.equal(
    computeVariantUnitPriceUAH({
      variant: buildVariant({ priceUAH: 2000, discountUAH: 25 }),
    }),
    1500,
  )
})

test('option surcharges are added on top of the discounted price', () => {
  assert.equal(
    computeVariantUnitPriceUAH({
      variant: buildVariant({ priceUAH: 2000, discountPercent: 10 }),
      extras: [150, 100, 50],
    }),
    2100, // 1800 + 300
  )
})

test('negative or malformed surcharges cannot reduce the price', () => {
  assert.equal(
    computeVariantUnitPriceUAH({
      variant: buildVariant({ priceUAH: 2000 }),
      extras: [-500, Number.NaN, null, undefined],
    }),
    2000,
  )
})

test('a matching cart reprices to the same subtotal', () => {
  const variant = buildVariant({ priceUAH: 2000 })
  const result = repriceOrderLines(
    [buildLine({ qty: 2, priceUAH: 2000 })],
    catalogOf(variant),
  )

  assert.deepEqual(result.issues, [])
  assert.equal(result.subtotalUAH, 4000)
  assert.deepEqual(result.lines, [
    { index: 0, unitPriceUAH: 2000, lineTotalUAH: 4000 },
  ])
})

test('a tampered lower price is rejected, not silently accepted', () => {
  const result = repriceOrderLines(
    [buildLine({ priceUAH: 1 })],
    catalogOf(buildVariant({ priceUAH: 2000 })),
  )

  assert.equal(result.subtotalUAH, 0)
  assert.deepEqual(result.issues, [
    {
      code: 'PRICE_CHANGED',
      index: 0,
      name: 'Сумка',
      submittedUAH: 1,
      actualUAH: 2000,
    },
  ])
})

test('a stale higher price is rejected too, so nobody is overcharged', () => {
  const result = repriceOrderLines(
    [buildLine({ priceUAH: 2400 })],
    catalogOf(buildVariant({ priceUAH: 2000 })),
  )

  assert.equal(result.issues[0]?.code, 'PRICE_CHANGED')
})

test('a line with no variant cannot be verified and is refused', () => {
  const result = repriceOrderLines(
    [buildLine({ variantId: null })],
    catalogOf(buildVariant()),
  )

  assert.deepEqual(result.issues, [
    { code: 'UNKNOWN_VARIANT', index: 0, name: 'Сумка' },
  ])
})

test('a variant that no longer exists is refused', () => {
  const result = repriceOrderLines(
    [buildLine({ variantId: 'deleted-variant' })],
    catalogOf(buildVariant()),
  )

  assert.equal(result.issues[0]?.code, 'UNKNOWN_VARIANT')
})

test('options belonging to the variant are priced', () => {
  const variant = buildVariant({
    priceUAH: 2000,
    strapExtraById: new Map([['strap-1', 300]]),
    sizeExtraById: new Map([['size-1', 100]]),
    pouchExtraById: new Map([['pouch-1', 0]]),
  })

  const result = repriceOrderLines(
    [
      buildLine({
        strapId: 'strap-1',
        sizeId: 'size-1',
        pouchId: 'pouch-1',
        priceUAH: 2400,
      }),
    ],
    catalogOf(variant),
  )

  assert.deepEqual(result.issues, [])
  assert.equal(result.subtotalUAH, 2400)
})

test('an option from a different variant is refused, not ignored', () => {
  // Ignoring it would quietly change what was ordered; accepting it would let a
  // cheap variant borrow another variant's options.
  const variant = buildVariant({
    strapExtraById: new Map([['strap-1', 300]]),
  })

  const result = repriceOrderLines(
    [buildLine({ strapId: 'strap-from-elsewhere', priceUAH: 2000 })],
    catalogOf(variant),
  )

  assert.deepEqual(result.issues, [
    { code: 'UNKNOWN_OPTION', index: 0, name: 'Сумка', option: 'strap' },
  ])
})

test('an absent option is not an error', () => {
  const variant = buildVariant({
    strapExtraById: new Map([['strap-1', 300]]),
  })

  const result = repriceOrderLines(
    [buildLine({ strapId: null, sizeId: '', pouchId: undefined })],
    catalogOf(variant),
  )

  assert.deepEqual(result.issues, [])
  assert.equal(result.subtotalUAH, 2000)
})

test('every bad line is reported, not just the first', () => {
  const result = repriceOrderLines(
    [
      buildLine({ name: 'A', priceUAH: 1 }),
      buildLine({ name: 'B', variantId: 'missing' }),
      buildLine({ name: 'C', priceUAH: 2000 }),
    ],
    catalogOf(buildVariant({ priceUAH: 2000 })),
  )

  assert.equal(result.issues.length, 2)
  assert.deepEqual(
    result.issues.map((issue) => issue.name),
    ['A', 'B'],
  )
  // The good line still prices, but the caller is expected to refuse the order.
  assert.equal(result.subtotalUAH, 2000)
})

test('quantities are normalised to whole non-negative numbers', () => {
  const variant = buildVariant({ priceUAH: 1000 })

  assert.equal(
    repriceOrderLines([buildLine({ qty: 2.9, priceUAH: 1000 })], catalogOf(variant))
      .subtotalUAH,
    2000,
  )
  assert.equal(
    repriceOrderLines([buildLine({ qty: -5, priceUAH: 1000 })], catalogOf(variant))
      .subtotalUAH,
    0,
  )
})

test('a multi-line cart sums correctly', () => {
  const bag = buildVariant({ id: 'bag', priceUAH: 2500, discountPercent: 20 })
  const charm = buildVariant({ id: 'charm', priceUAH: 300 })

  const result = repriceOrderLines(
    [
      buildLine({ name: 'Bag', variantId: 'bag', qty: 2, priceUAH: 2000 }),
      buildLine({ name: 'Charm', variantId: 'charm', qty: 3, priceUAH: 300 }),
    ],
    catalogOf(bag, charm),
  )

  assert.deepEqual(result.issues, [])
  assert.equal(result.subtotalUAH, 4000 + 900)
})
