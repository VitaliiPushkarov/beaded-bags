import test from 'node:test'
import assert from 'node:assert/strict'

import { cartLineKey } from './cart'

const line = {
  productId: 'cozy-bag',
  variantId: 'cozy-bag-00',
  strapId: null,
  pouchStrapId: null,
  sizeId: null,
  pouchId: null,
}

test('the same pouch with a different strap is a different line', () => {
  // The pouch+strap configurator stores its strap in pouchStrapId, so a key
  // built from strapId alone collapsed both choices into one line: React
  // rendered them under the same key, and remove/qty hit whichever came first.
  const beigeWithBlue = { ...line, pouchId: 'pouch-1', pouchStrapId: 'strap-1' }
  const beigeWithNavy = { ...line, pouchId: 'pouch-1', pouchStrapId: 'strap-2' }

  assert.notEqual(cartLineKey(beigeWithBlue), cartLineKey(beigeWithNavy))
})

test('the same choices are the same line, however they are spelled', () => {
  const withNulls = { ...line, pouchId: 'pouch-1', pouchStrapId: 'strap-1' }
  const withUndefined = {
    productId: 'cozy-bag',
    variantId: 'cozy-bag-00',
    strapId: undefined,
    pouchStrapId: 'strap-1',
    sizeId: undefined,
    pouchId: 'pouch-1',
  }

  assert.equal(cartLineKey(withNulls), cartLineKey(withUndefined))
})

test('ids that contain dashes cannot bleed into the next field', () => {
  // `cozy-bag` + `cozy-bag-00` joined by dashes reads the same as several other
  // id pairs; the separator has to be one the ids never use.
  const a = { ...line, productId: 'cozy', variantId: 'bag-cozy-bag-00' }
  const b = { ...line, productId: 'cozy-bag', variantId: 'cozy-bag-00' }

  assert.notEqual(cartLineKey(a), cartLineKey(b))
})

test('every option that can differ takes part in the identity', () => {
  const base = cartLineKey(line)

  for (const option of [
    'strapId',
    'pouchStrapId',
    'sizeId',
    'pouchId',
  ] as const) {
    assert.notEqual(
      cartLineKey({ ...line, [option]: 'x' }),
      base,
      `${option} is missing from the cart line key`,
    )
  }
})
