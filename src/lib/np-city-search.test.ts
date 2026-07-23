import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildNpCityQueryVariants,
  dedupeCityOptions,
  normalizeNpCityQuery,
} from './np-city-search'

test('normalizeNpCityQuery converts typographic apostrophes for Nova Poshta', () => {
  assert.equal(normalizeNpCityQuery('Камʼянське'), "Кам'янське")
  assert.equal(normalizeNpCityQuery('Кам’янське'), "Кам'янське")
})

test('buildNpCityQueryVariants adds fallbacks for common city input mistakes', () => {
  assert.deepEqual(buildNpCityQueryVariants('Kyiv'), ['Київ'])
  assert.deepEqual(buildNpCityQueryVariants('Івано Франківськ'), [
    'Івано Франківськ',
    'Івано-Франківськ',
  ])
  assert.deepEqual(buildNpCityQueryVariants('Камянське'), [
    'Камянське',
    "Кам'янське",
  ])
})

test('buildNpCityQueryVariants strips settlement prefixes', () => {
  assert.deepEqual(buildNpCityQueryVariants('м. Київ'), ['м Київ', 'Київ'])
})

test('dedupeCityOptions keeps same-name settlements with different refs', () => {
  const rows = [
    {
      settlementRef: 'first',
      name: 'Новоселівка',
      area: 'Донецька',
      region: "Слов'янський",
      type: 'село',
    },
    {
      settlementRef: 'second',
      name: 'Новоселівка',
      area: 'Донецька',
      region: 'Ясинуватський',
      type: 'село',
    },
  ]

  assert.equal(dedupeCityOptions(rows).length, 2)
})
