import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveOptionColor, resolveOptionSwatchColor } from './product-options'

test('a picked hex wins over the colour derived from the label', () => {
  // The regression this guards: "Рожевий" derives #F7A8C8, so ignoring the
  // stored hex made every colour picked in admin invisible on the shop.
  assert.equal(resolveOptionSwatchColor('Рожевий'), '#F7A8C8')
  assert.equal(resolveOptionColor('#e170a1', 'Рожевий'), '#e170a1')
})

test('an unset hex falls back to the colour derived from the label', () => {
  for (const empty of [null, undefined, '', '   ']) {
    assert.equal(resolveOptionColor(empty, 'Рожевий'), '#F7A8C8')
  }
})

test('hex shorthands and a missing # are accepted', () => {
  assert.equal(resolveOptionColor('#FFF', 'Рожевий'), '#fff')
  assert.equal(resolveOptionColor('e170a1', 'Рожевий'), '#e170a1')
  assert.equal(resolveOptionColor('  #E170A1  ', 'Рожевий'), '#e170a1')
  assert.equal(resolveOptionColor('#e170a180', 'Рожевий'), '#e170a180')
})

test('a hex that is not a colour cannot reach the style attribute', () => {
  for (const junk of ['red', '#12', '#1234', 'rgb(225,112,161)', '#gggggg']) {
    assert.equal(resolveOptionColor(junk, 'Рожевий'), '#F7A8C8')
  }
})

test('an option with neither a hex nor a recognisable label has no colour', () => {
  assert.equal(resolveOptionColor(null, 'Спортивний'), null)
  assert.equal(resolveOptionColor('', ''), null)
})
