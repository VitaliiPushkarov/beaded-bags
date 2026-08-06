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

test('removing a saved variant asks for confirmation and names the variant', () => {
  const message = buildVariantRemovalConfirmation(
    { id: 'variant-1', color: 'чорний', modelSize: 'M', pouchColor: '' },
    0,
  )

  assert.equal(message, 'Видалити варіант «чорний / M»?')
})

test('removing an unsaved variant does not cry wolf', () => {
  const message = buildVariantRemovalConfirmation(
    { color: 'новий', modelSize: '', pouchColor: '' },
    1,
  )

  assert.match(message, /новий/)
  // Nothing exists in the database yet, so the prompt is only about the form.
  assert.match(message, /Введені дані буде втрачено/)
})

test('an empty id is treated as unsaved, not as a database row', () => {
  const message = buildVariantRemovalConfirmation({ id: '', ...blank }, 0)
  assert.match(message, /Введені дані буде втрачено/)
})
