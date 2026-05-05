import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildArtisanRateTableRows,
  buildArtisanVariantLabel,
  parseArtisanProductionSettlementFromFormData,
  parseArtisanRateUpdatesFromFormData,
  type ArtisanVariantOption,
} from '@/lib/admin-artisans'

test('buildArtisanVariantLabel uses first available variant detail', () => {
  const variant: ArtisanVariantOption = {
    id: 'variant_123456789',
    sku: 'SKU-11',
    color: 'Чорний',
    modelSize: null,
    pouchColor: null,
    product: {
      name: 'Сумка',
      slug: 'sumka',
    },
  }

  assert.equal(
    buildArtisanVariantLabel(variant),
    'Сумка (sumka) • Чорний',
  )
})

test('buildArtisanRateTableRows sorts rows by label', () => {
  const variants: ArtisanVariantOption[] = [
    {
      id: 'b',
      sku: null,
      color: 'Синій',
      modelSize: null,
      pouchColor: null,
      product: { name: 'Бананка', slug: 'bananka' },
    },
    {
      id: 'a',
      sku: null,
      color: 'Зелений',
      modelSize: null,
      pouchColor: null,
      product: { name: 'Аксесуар', slug: 'aksesuar' },
    },
  ]

  const rows = buildArtisanRateTableRows({
    variants,
    ratesByVariantId: new Map([
      ['a', { ratePerUnitUAH: 250 }],
      ['b', { ratePerUnitUAH: 300 }],
    ]),
  })

  assert.deepEqual(
    rows.map((row) => row.id),
    ['a', 'b'],
  )
})

test('parseArtisanRateUpdatesFromFormData parses selected rows and rates', () => {
  const formData = new FormData()
  formData.set('artisanId', 'artisan_1')
  formData.append('selectedVariantIds', 'variant_2')
  formData.append('selectedVariantIds', 'variant_1')
  formData.set('rate_variant_1', '450')
  formData.set('rate_variant_2', '500')

  const parsed = parseArtisanRateUpdatesFromFormData(formData)

  assert.equal(parsed.artisanId, 'artisan_1')
  assert.deepEqual(parsed.updates, [
    { variantId: 'variant_2', ratePerUnitUAH: 500 },
    { variantId: 'variant_1', ratePerUnitUAH: 450 },
  ])
})

test('parseArtisanRateUpdatesFromFormData throws on invalid rate', () => {
  const formData = new FormData()
  formData.set('artisanId', 'artisan_1')
  formData.append('selectedVariantIds', 'variant_1')
  formData.set('rate_variant_1', '0')

  assert.throws(
    () => parseArtisanRateUpdatesFromFormData(formData),
    /Некоректна ставка для варіанта variant_1/,
  )
})

test('parseArtisanProductionSettlementFromFormData parses debt/paid state', () => {
  const formData = new FormData()
  formData.set('productionId', 'prod_1')
  formData.set('artisanId', 'artisan_1')
  formData.set('status', 'PAID')
  formData.set('settledAmountUAH', '900')

  const parsed = parseArtisanProductionSettlementFromFormData(formData)

  assert.deepEqual(parsed, {
    productionId: 'prod_1',
    artisanId: 'artisan_1',
    status: 'PAID',
    settledAmountUAH: 900,
  })
})

test('parseArtisanProductionSettlementFromFormData throws on negative amount', () => {
  const formData = new FormData()
  formData.set('productionId', 'prod_1')
  formData.set('artisanId', 'artisan_1')
  formData.set('status', 'DEBT')
  formData.set('settledAmountUAH', '-1')

  assert.throws(
    () => parseArtisanProductionSettlementFromFormData(formData),
    /Некоректна сума погашення/,
  )
})
