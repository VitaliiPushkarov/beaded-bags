import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildVariantRemovalConfirmation,
  describeSaveError,
  describeVariant,
  mergePouchStraps,
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

test('a server message is shown as it arrived', () => {
  assert.equal(describeSaveError('Product with this slug already exists'), 'Product with this slug already exists')
})

test('a rejected payload names the fields instead of rendering an object', () => {
  // The endpoints answer 400 with a flattened Zod report. Putting that object in
  // JSX crashes the page, so it has to be turned into text first.
  const message = describeSaveError({
    formErrors: [],
    fieldErrors: { variants: ['Invalid image path'], slug: ['Too small'] },
  })

  assert.match(message, /variants: Invalid image path/)
  assert.match(message, /slug: Too small/)
})

const strap = (
  name: string,
  extra: Partial<{ id: string; hex: string; mainImageUrl: string; sort: string }> = {},
) => ({ name, hex: '', sort: '0', mainImageUrl: '', ...extra })

test('picked straps arrive with their labels and swatches', () => {
  const merged = mergePouchStraps(
    [
      strap('Блакитний', { id: 'a1', hex: '#8fc4ff', mainImageUrl: '/beige-blue.jpg' }),
      strap('Синій', { id: 'a2', hex: '#7197e5', mainImageUrl: '/beige-navy.jpg' }),
    ],
    [],
  )

  assert.deepEqual(
    merged.map((s) => [s.name, s.hex, s.sort]),
    [
      ['Блакитний', '#8fc4ff', '0'],
      ['Синій', '#7197e5', '1'],
    ],
  )
})

test('the photo is never copied — it is the one field that is per pouch', () => {
  const merged = mergePouchStraps([strap('Блакитний', { mainImageUrl: '/beige-blue.jpg' })], [])
  assert.equal(merged[0].mainImageUrl, '')
})

test('copying does not carry the source ids onto another pouch', () => {
  const merged = mergePouchStraps([strap('Блакитний', { id: 'belongs-to-beige' })], [])
  assert.equal(merged[0].id, undefined)
})

test('straps the pouch already had are kept, not replaced by the picked ones', () => {
  // Picking two straps must not wipe the third one this pouch already offers.
  const merged = mergePouchStraps(
    [strap('Блакитний'), strap('Жовтий')],
    [strap('Пудровий', { id: 'own', mainImageUrl: '/pink-powder.jpg' })],
  )

  assert.deepEqual(
    merged.map((s) => s.name),
    ['Пудровий', 'Блакитний', 'Жовтий'],
  )
  assert.equal(merged[0].mainImageUrl, '/pink-powder.jpg')
  assert.deepEqual(
    merged.map((s) => s.sort),
    ['0', '1', '2'],
  )
})

test('a strap the pouch already has is updated in place, keeping its photo', () => {
  const merged = mergePouchStraps(
    [strap('Блакитний', { hex: '#8fc4ff' })],
    [strap(' блакитний ', { id: 'pink-blue', mainImageUrl: '/pink-blue.jpg' })],
  )

  assert.equal(merged.length, 1, 'no twin is created for a name already there')
  assert.equal(merged[0].id, 'pink-blue')
  assert.equal(merged[0].mainImageUrl, '/pink-blue.jpg')
  // ...and the swatch still comes from the source.
  assert.equal(merged[0].hex, '#8fc4ff')
})

test('a half-typed row does not swallow the picked straps', () => {
  // An empty name matches nothing, so picking onto a pouch with a blank row
  // appends instead of overwriting that row.
  const merged = mergePouchStraps([strap('Блакитний')], [strap('')])

  assert.deepEqual(
    merged.map((s) => s.name),
    ['', 'Блакитний'],
  )
})

test('an unrecognisable error still says something', () => {
  assert.equal(describeSaveError(undefined), 'Помилка збереження')
  assert.equal(describeSaveError({}), 'Помилка збереження')
  assert.equal(describeSaveError(''), 'Помилка збереження')
})
