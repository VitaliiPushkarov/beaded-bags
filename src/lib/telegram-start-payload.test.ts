import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildStartRegistrationPayload,
  parseStartRegistrationPayload,
} from '@/lib/telegram-start-payload'

test('build + parse start payload roundtrip for numeric code', () => {
  const payload = buildStartRegistrationPayload('123456')
  assert.ok(payload.startsWith('regb64_'))
  assert.equal(parseStartRegistrationPayload(payload), '123456')
})

test('build + parse start payload roundtrip for unicode code', () => {
  const payload = buildStartRegistrationPayload('Код-Майстер-01')
  assert.ok(payload.startsWith('regb64_'))
  assert.equal(parseStartRegistrationPayload(payload), 'Код-Майстер-01')
})

test('parse accepts legacy raw payload formats', () => {
  assert.equal(parseStartRegistrationPayload('reg_7890'), '7890')
  assert.equal(parseStartRegistrationPayload('register_7890'), '7890')
  assert.equal(parseStartRegistrationPayload('7890'), '7890')
})
