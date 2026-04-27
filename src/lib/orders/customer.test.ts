import test from 'node:test'
import assert from 'node:assert/strict'

import { buildOrderCustomerSchema, formatCustomerFullName } from './customer'

test('buildOrderCustomerSchema accepts payload without patronymic', () => {
  const schema = buildOrderCustomerSchema(2)
  const parsed = schema.safeParse({
    name: 'Ірина',
    surname: 'Шевченко',
    phone: '380501112233',
    email: 'iryna@example.com',
  })

  assert.equal(parsed.success, true)
  if (!parsed.success) return
  assert.equal(parsed.data.patronymic, undefined)
})

test('buildOrderCustomerSchema accepts legacy patronymic field', () => {
  const schema = buildOrderCustomerSchema(2)
  const parsed = schema.safeParse({
    name: 'Олена',
    surname: 'Коваль',
    patronymic: 'Петрівна',
    phone: '380501112233',
    email: 'olena@example.com',
  })

  assert.equal(parsed.success, true)
  if (!parsed.success) return
  assert.equal(parsed.data.patronymic, 'Петрівна')
})

test('buildOrderCustomerSchema respects minLength per route needs', () => {
  const strictSchema = buildOrderCustomerSchema(2)
  const relaxedSchema = buildOrderCustomerSchema(1)

  assert.equal(
    strictSchema.safeParse({
      name: 'І',
      surname: 'П',
      phone: '12345',
      email: 'a@b.co',
    }).success,
    false,
  )

  assert.equal(
    relaxedSchema.safeParse({
      name: 'І',
      surname: 'П',
      phone: '12345',
      email: 'a@b.co',
    }).success,
    true,
  )
})

test('formatCustomerFullName omits missing patronymic and extra spaces', () => {
  assert.equal(
    formatCustomerFullName({
      name: '  Марія ',
      surname: '  Іваненко ',
      patronymic: ' ',
    }),
    'Марія Іваненко',
  )

  assert.equal(
    formatCustomerFullName({
      name: 'Марія',
      surname: 'Іваненко',
      patronymic: 'Петрівна',
    }),
    'Марія Іваненко Петрівна',
  )
})
