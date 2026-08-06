import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildLiqPayCatalogExternalCode,
  buildLiqPayCatalogRows,
  resolveLiqPayGoodId,
  serializeLiqPayCatalogRows,
} from './liqpay-catalog'

test('buildLiqPayCatalogRows generates stable external codes for variants and options', () => {
  const rows = buildLiqPayCatalogRows([
    {
      slug: 'classic-mini',
      name: 'Classic Mini',
      type: 'BAG',
      basePriceUAH: 4200,
      variants: [
        {
          id: 'variant-red',
          sku: 'CM-RED',
          color: 'Червоний',
          modelSize: null,
          pouchColor: null,
          priceUAH: 4200,
          discountPercent: 0,
          discountUAH: 0,
          straps: [
            {
              id: 'strap-chain',
              name: 'Ланцюжок',
              extraPriceUAH: 300,
            },
          ],
          pouches: [],
          sizes: [
            {
              id: 'size-xl',
              size: 'XL',
              extraPriceUAH: 500,
            },
          ],
        },
      ],
    },
  ])

  assert.deepEqual(
    rows.map((row) => row.externalCode).sort(),
    [
      buildLiqPayCatalogExternalCode('VARIANT', 'variant-red'),
      buildLiqPayCatalogExternalCode('STRAP', 'strap-chain'),
      buildLiqPayCatalogExternalCode('SIZE', 'size-xl'),
    ].sort(),
  )
  assert.match(serializeLiqPayCatalogRows(rows), /vrn-variant-red/)
  assert.match(serializeLiqPayCatalogRows(rows), /stp-strap-chain/)
})

test('resolveLiqPayGoodId prefers manual override and falls back to synced mapping', () => {
  const externalCode = buildLiqPayCatalogExternalCode('POUCH', 'pouch-gold')
  const mappings = new Map([[externalCode, 4242]])

  assert.equal(
    resolveLiqPayGoodId({
      entityType: 'POUCH',
      entityId: 'pouch-gold',
      manualGoodId: 9999,
      mappingsByExternalCode: mappings,
    }),
    9999,
  )

  assert.equal(
    resolveLiqPayGoodId({
      entityType: 'POUCH',
      entityId: 'pouch-gold',
      manualGoodId: null,
      mappingsByExternalCode: mappings,
    }),
    4242,
  )
})

// The ПРРО catalogue price has to be the price the shop actually charges. If it
// drifts, the fiscal receipt disagrees with the order.
function priceOfVariantRow(input: {
  priceUAH: number | null
  discountPercent: number | null
  discountUAH: number | null
}) {
  const [row] = buildLiqPayCatalogRows([
    {
      slug: 's',
      name: 'Product',
      type: 'BAG',
      basePriceUAH: null,
      variants: [
        {
          id: 'v1',
          sku: null,
          color: null,
          modelSize: null,
          pouchColor: null,
          straps: [],
          pouches: [],
          sizes: [],
          ...input,
        },
      ],
    },
  ])
  return row.price
}

test('a percentage discount is registered at the discounted price', () => {
  // Regression: the export used to subtract discountUAH raw and ignore
  // discountPercent entirely, registering discounted items at full price.
  assert.equal(
    priceOfVariantRow({ priceUAH: 950, discountPercent: 25, discountUAH: null }),
    712,
  )
  assert.equal(
    priceOfVariantRow({ priceUAH: 420, discountPercent: 5, discountUAH: null }),
    399,
  )
})

test('the legacy discountUAH field keeps its percent semantics', () => {
  // Values <= 100 are percentages, per resolveDiscountPercent.
  assert.equal(
    priceOfVariantRow({ priceUAH: 2000, discountPercent: null, discountUAH: 25 }),
    1500,
  )
  // Larger values are genuine legacy absolute amounts.
  assert.equal(
    priceOfVariantRow({ priceUAH: 2000, discountPercent: null, discountUAH: 500 }),
    1500,
  )
})

test('an undiscounted variant is registered at its full price', () => {
  assert.equal(
    priceOfVariantRow({ priceUAH: 1599, discountPercent: 0, discountUAH: 0 }),
    1599,
  )
  assert.equal(
    priceOfVariantRow({ priceUAH: 1599, discountPercent: null, discountUAH: null }),
    1599,
  )
})
