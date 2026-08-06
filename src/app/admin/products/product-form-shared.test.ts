import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildVariantRemovalConfirmation,
  describeVariant,
} from './product-form-shared'

const blank = { color: '', modelSize: '', pouchColor: '' }

test('a variant is described by its chosen options', () => {
  assert.equal(
    describeVariant({ color: 'чорний', modelSize: 'M', pouchColor: '' }, 0),
    'чорний / M',
  )
  assert.equal(
    describeVariant(
      { color: 'чорний', modelSize: '', pouchColor: 'молочний' },
      0,
    ),
    'чорний / молочний',
  )
})

test('a variant with no options falls back to its position', () => {
  assert.equal(describeVariant(blank, 0), 'Варіант #1')
  assert.equal(describeVariant({ ...blank, color: '   ' }, 2), 'Варіант #3')
})

test('removing a saved variant warns about what the save will destroy', () => {
  const message = buildVariantRemovalConfirmation(
    { id: 'variant-1', color: 'чорний', modelSize: 'M', pouchColor: '' },
    0,
  )

  assert.match(message, /чорний \/ M/)
  // The consequences that are not obvious from the UI.
  assert.match(message, /залишки на складі/)
  assert.match(message, /ставки майстринь/)
  assert.match(message, /історія виробництва/)
  // Deletion happens on save, so it is still recoverable until then.
  assert.match(message, /не збережено/)
})

test('removing an unsaved variant does not cry wolf', () => {
  const message = buildVariantRemovalConfirmation(
    { color: 'новий', modelSize: '', pouchColor: '' },
    1,
  )

  assert.match(message, /новий/)
  assert.match(message, /Введені дані буде втрачено/)
  // Nothing exists in the database yet, so none of these apply.
  assert.doesNotMatch(message, /залишки на складі/)
  assert.doesNotMatch(message, /ставки майстринь/)
  assert.doesNotMatch(message, /історія виробництва/)
})

test('an empty id is treated as unsaved, not as a database row', () => {
  const message = buildVariantRemovalConfirmation({ id: '', ...blank }, 0)
  assert.doesNotMatch(message, /залишки на складі/)
})
