import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeSearchString,
  parseMonthLabel,
  parseOptionalNumber,
} from './gerdan-normalize'

test('normalizeSearchString normalizes spaces and multiplier chars', () => {
  assert.equal(
    normalizeSearchString('  Classic\u00A0Mini ×  14 х 20 x 4 cm  '),
    'classic mini x 14 x 20 x 4 cm',
  )
})

test('parseOptionalNumber parses localized numeric values', () => {
  assert.equal(parseOptionalNumber('1,234.50'), 1234.5)
  assert.equal(parseOptionalNumber('87.775999999999996'), 87.775999999999996)
  assert.equal(parseOptionalNumber(''), null)
})

test('parseMonthLabel parses ukrainian month labels', () => {
  assert.deepEqual(parseMonthLabel('2026 січень'), {
    year: 2026,
    month: 1,
  })
  assert.equal(parseMonthLabel('січень'), null)
})
