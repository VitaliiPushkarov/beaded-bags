import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { ADMIN_AUTH_COOKIE_NAME, createAdminSessionToken } from './admin-auth'
import { DEFAULT_ORDER_EMAIL_SETTINGS } from './order-email-copy'
import { PUT } from '../app/api/admin/order-email/route'
import { GET } from '../app/api/cron/order-emails/route'

const originalEnv = { ...process.env }
afterEach(() => {
  process.env = { ...originalEnv }
})

test('the template editor endpoint rejects anonymous writes before touching the database', async () => {
  const response = await PUT(
    new NextRequest('https://gerdan.online/api/admin/order-email', {
      method: 'PUT',
      body: JSON.stringify(DEFAULT_ORDER_EMAIL_SETTINGS),
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  assert.equal(response.status, 401)
})

test('an authenticated editor cannot save invalid copy or malformed JSON', async () => {
  process.env.ADMIN_SESSION_SECRET = 'test-session-secret'
  const token = await createAdminSessionToken()
  for (const body of ['{invalid', JSON.stringify({ uk: {} })]) {
    const response = await PUT(
      new NextRequest('https://gerdan.online/api/admin/order-email', {
        method: 'PUT',
        body,
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${ADMIN_AUTH_COOKIE_NAME}=${token}`,
        },
      }),
    )
    assert.equal(response.status, 400)
  }
})

test('the scheduler fails closed without a secret or with an incorrect bearer token', async () => {
  delete process.env.CRON_SECRET
  assert.equal(
    (await GET(new NextRequest('https://gerdan.online/api/cron/order-emails')))
      .status,
    503,
  )
  process.env.CRON_SECRET = 'scheduler-test-secret'
  for (const authorization of [
    '',
    'Bearer wrong',
    'Bearer scheduler-test-secrex',
  ]) {
    const response = await GET(
      new NextRequest('https://gerdan.online/api/cron/order-emails', {
        headers: { authorization },
      }),
    )
    assert.equal(response.status, 401)
  }
})
