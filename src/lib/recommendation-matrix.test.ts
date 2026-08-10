import test from 'node:test'
import assert from 'node:assert/strict'

import {
  RECOMMENDATION_MATRIX_DEFAULTS,
  normalizeRecommendationMatrix,
  resolveRecommendedTypes,
  toRecommendationCategory,
} from './recommendation-matrix'

test('the seven product types fold into the five visible categories', () => {
  assert.equal(toRecommendationCategory('BACKPACK'), 'BAG')
  assert.equal(toRecommendationCategory('ORNAMENTS'), 'ACCESSORY')
  assert.equal(toRecommendationCategory('CASE'), 'CASE')
  assert.equal(toRecommendationCategory('NOT_A_TYPE'), null)
  assert.equal(toRecommendationCategory(null), null)
})

test('a missing or unusable payload falls back to same-category defaults', () => {
  assert.deepEqual(
    normalizeRecommendationMatrix(null),
    RECOMMENDATION_MATRIX_DEFAULTS,
  )
  assert.deepEqual(
    normalizeRecommendationMatrix('nonsense'),
    RECOMMENDATION_MATRIX_DEFAULTS,
  )
})

test('a row that is present but empty means the block is switched off', () => {
  const matrix = normalizeRecommendationMatrix({ CASE: [] })

  // The empty row survives instead of being refilled with the default...
  assert.deepEqual(matrix.CASE, [])
  assert.deepEqual(resolveRecommendedTypes(matrix, 'CASE'), [])
  // ...while rows absent from the payload still get their default.
  assert.deepEqual(matrix.BAG, ['BAG'])
})

test('unknown categories are dropped and duplicates collapse', () => {
  const matrix = normalizeRecommendationMatrix({
    BAG: ['CASE', 'FICTIONAL', 'CASE', 'BAG'],
  })

  assert.deepEqual(matrix.BAG, ['BAG', 'CASE'])
})

test('row order is normalized so the block does not depend on click order', () => {
  const clickedInReverse = normalizeRecommendationMatrix({
    BAG: ['ACCESSORY', 'CASE', 'BAG'],
  })
  const clickedInOrder = normalizeRecommendationMatrix({
    BAG: ['BAG', 'CASE', 'ACCESSORY'],
  })

  assert.deepEqual(clickedInReverse.BAG, clickedInOrder.BAG)
})

test('resolving expands a category back into every type it covers', () => {
  const matrix = normalizeRecommendationMatrix({ CASE: ['BAG', 'ACCESSORY'] })

  // BAG covers BACKPACK and ACCESSORY covers ORNAMENTS, so a product tagged
  // with either still shows up in the block.
  assert.deepEqual(resolveRecommendedTypes(matrix, 'CASE'), [
    'BAG',
    'BACKPACK',
    'ACCESSORY',
    'ORNAMENTS',
  ])
})

test('a product of an unknown type recommends nothing', () => {
  const matrix = normalizeRecommendationMatrix(null)

  assert.deepEqual(resolveRecommendedTypes(matrix, 'MYSTERY'), [])
})

test('defaults keep a product inside its own category', () => {
  const matrix = normalizeRecommendationMatrix(null)

  assert.deepEqual(resolveRecommendedTypes(matrix, 'BAG'), ['BAG', 'BACKPACK'])
  assert.deepEqual(resolveRecommendedTypes(matrix, 'BACKPACK'), [
    'BAG',
    'BACKPACK',
  ])
  assert.deepEqual(resolveRecommendedTypes(matrix, 'SHOPPER'), ['SHOPPER'])
})
