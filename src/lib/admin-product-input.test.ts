import test from 'node:test'
import assert from 'node:assert/strict'

import { ImagePath, OptionalImagePath, OptionalText } from './admin-product-input'

test('a blank SKU is stored as NULL, not as an empty string', () => {
  // '' in a unique column is a value: the second variant saved without a SKU
  // used to collide with the first and Prisma answered P2002.
  assert.equal(OptionalText.parse(''), null)
  assert.equal(OptionalText.parse('   '), null)
  assert.equal(OptionalText.parse(null), null)
  assert.equal(OptionalText.parse(undefined), null)
  assert.equal(OptionalText.parse(' 101703 '), '101703')
})

test('a variant may be saved without a photo', () => {
  assert.equal(OptionalImagePath.parse(''), null)
  assert.equal(OptionalImagePath.parse('  '), null)
  assert.equal(OptionalImagePath.parse(undefined), null)
  assert.equal(OptionalImagePath.parse('/img/bag.jpg'), '/img/bag.jpg')
  assert.equal(
    OptionalImagePath.parse('https://res.cloudinary.com/x.jpg'),
    'https://res.cloudinary.com/x.jpg',
  )
})

test('a non-empty image still has to look like a path', () => {
  assert.throws(() => OptionalImagePath.parse('res.cloudinary.com/x.jpg'))
  assert.throws(() => ImagePath.parse(''))
})
