import test from 'node:test'
import assert from 'node:assert/strict'
import {
  areOrderEmailsEnabled,
  readOrderSmtpConfig,
} from './order-email-config'

test('mail is automatic in production, with an explicit override and no preview sends by default', () => {
  assert.equal(areOrderEmailsEnabled({ NODE_ENV: 'production' }), true)
  assert.equal(
    areOrderEmailsEnabled({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }),
    false,
  )
  assert.equal(
    areOrderEmailsEnabled({
      NODE_ENV: 'production',
      ORDER_EMAILS_ENABLED: 'false',
    }),
    false,
  )
  assert.equal(areOrderEmailsEnabled({ NODE_ENV: 'development' }), false)
  assert.equal(
    areOrderEmailsEnabled({
      NODE_ENV: 'development',
      ORDER_EMAILS_ENABLED: 'true',
    }),
    true,
  )
})

test('Gmail uses the studio address, TLS and a normalized app password', () => {
  const config = readOrderSmtpConfig({ SMTP_PASSWORD: 'abcd efgh ijkl mnop' })
  assert.equal(config?.host, 'smtp.gmail.com')
  assert.equal(config?.port, 465)
  assert.equal(config?.secure, true)
  assert.equal(config?.user, 'gerdanstudio@gmail.com')
  assert.equal(config?.from, 'GERDAN <gerdanstudio@gmail.com>')
  assert.equal(config?.replyTo, 'gerdanstudio@gmail.com')
  assert.equal(config?.password, 'abcdefghijklmnop')
})

test('missing credentials or invalid ports never produce a sendable config', () => {
  assert.equal(readOrderSmtpConfig({}), null)
  assert.equal(
    readOrderSmtpConfig({ SMTP_PASSWORD: 'test', SMTP_PORT: 'abc' }),
    null,
  )
  assert.equal(
    readOrderSmtpConfig({ SMTP_PASSWORD: 'test', SMTP_PORT: '65536' }),
    null,
  )
  assert.equal(
    readOrderSmtpConfig({ SMTP_PASSWORD: 'test', SMTP_PORT: '587' })?.secure,
    false,
  )
})
