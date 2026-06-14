import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAverageLaborCostByVariantId,
  buildManagedUnitCostUAH,
} from '@/lib/management-accounting'

test('buildAverageLaborCostByVariantId calculates rounded mean for each variant', () => {
  const averages = buildAverageLaborCostByVariantId([
    { variantId: 'variant_a', ratePerUnitUAH: 200 },
    { variantId: 'variant_a', ratePerUnitUAH: 301 },
    { variantId: 'variant_b', ratePerUnitUAH: 450 },
  ])

  assert.equal(averages.get('variant_a'), 251)
  assert.equal(averages.get('variant_b'), 450)
  assert.equal(averages.has('missing_variant'), false)
})

test('buildManagedUnitCostUAH prefers laborCostUAHOverride over manual profile labor', () => {
  const unitCostUAH = buildManagedUnitCostUAH({
    profile: {
      laborCostUAH: 999,
      shippingCostUAH: 40,
      otherCostUAH: 20,
    },
    laborCostUAHOverride: 250,
    materialUsages: [
      {
        quantity: 2,
        notes: null,
        material: {
          unitCostUAH: 15,
        },
      },
    ],
    packagingTemplateCostUAH: 100,
    includeShipping: false,
  })

  assert.equal(unitCostUAH, 400)
})
