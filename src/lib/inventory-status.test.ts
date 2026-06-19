import assert from 'node:assert/strict'
import test from 'node:test'

import {
  deriveTrackedAvailabilityStatus,
  groupOrderVariantQuantities,
  isInventorySettledOrderStatus,
  normalizeInventoryQuantity,
} from './inventory-status'

test('normalizeInventoryQuantity clamps invalid values to non-negative ints', () => {
  assert.equal(normalizeInventoryQuantity(3.9), 3)
  assert.equal(normalizeInventoryQuantity(-4), 0)
  assert.equal(normalizeInventoryQuantity(Number.NaN), 0)
})

test('deriveTrackedAvailabilityStatus follows qty but preserves manual out-of-stock', () => {
  assert.equal(
    deriveTrackedAvailabilityStatus({
      currentStatus: 'IN_STOCK',
      nextQty: 0,
    }),
    'PREORDER',
  )
  assert.equal(
    deriveTrackedAvailabilityStatus({
      currentStatus: 'PREORDER',
      nextQty: 2,
    }),
    'IN_STOCK',
  )
  assert.equal(
    deriveTrackedAvailabilityStatus({
      currentStatus: 'OUT_OF_STOCK',
      nextQty: 5,
    }),
    'OUT_OF_STOCK',
  )
})

test('isInventorySettledOrderStatus tracks paid-like order states', () => {
  assert.equal(isInventorySettledOrderStatus('PAID'), true)
  assert.equal(isInventorySettledOrderStatus('FULFILLED'), true)
  assert.equal(isInventorySettledOrderStatus('PENDING'), false)
})

test('groupOrderVariantQuantities groups duplicates and ignores invalid rows', () => {
  assert.deepEqual(
    groupOrderVariantQuantities([
      { variantId: 'variant-1', qty: 1 },
      { variantId: 'variant-1', qty: 2 },
      { variantId: 'variant-2', qty: 3 },
      { variantId: '', qty: 4 },
      { variantId: 'variant-3', qty: 0 },
    ]),
    [
      { variantId: 'variant-1', qty: 3 },
      { variantId: 'variant-2', qty: 3 },
    ],
  )
})
