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
