import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'

import {
  isNovaPoshtaTransientError,
  npCall,
} from './np'

const originalFetch = globalThis.fetch
const originalApiKey = process.env.NOVA_POSHTA_API_KEY
const originalAttempts = process.env.NOVA_POSHTA_RETRY_ATTEMPTS
const originalTimeout = process.env.NOVA_POSHTA_TIMEOUT_MS

afterEach(() => {
  globalThis.fetch = originalFetch

  if (originalApiKey === undefined) delete process.env.NOVA_POSHTA_API_KEY
  else process.env.NOVA_POSHTA_API_KEY = originalApiKey

  if (originalAttempts === undefined) delete process.env.NOVA_POSHTA_RETRY_ATTEMPTS
  else process.env.NOVA_POSHTA_RETRY_ATTEMPTS = originalAttempts

  if (originalTimeout === undefined) delete process.env.NOVA_POSHTA_TIMEOUT_MS
  else process.env.NOVA_POSHTA_TIMEOUT_MS = originalTimeout
})

test('npCall retries transient fetch failures', async () => {
  let calls = 0
  process.env.NOVA_POSHTA_API_KEY = 'test-key'
  process.env.NOVA_POSHTA_RETRY_ATTEMPTS = '2'

  globalThis.fetch = async () => {
    calls += 1

    if (calls === 1) {
      throw new TypeError('fetch failed')
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: [{ Ref: 'warehouse-ref' }],
        errors: [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const data = await npCall<Array<{ Ref: string }>>(
    'AddressGeneral',
    'getWarehouses',
    { SettlementRef: 'settlement-ref' },
  )

  assert.equal(calls, 2)
  assert.deepEqual(data, [{ Ref: 'warehouse-ref' }])
})

test('npCall marks 5xx responses as transient Nova Poshta errors', async () => {
  process.env.NOVA_POSHTA_API_KEY = 'test-key'
  process.env.NOVA_POSHTA_RETRY_ATTEMPTS = '1'

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: false,
        data: [],
        errors: ['Service unavailable'],
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )

  await assert.rejects(
    () => npCall('AddressGeneral', 'getWarehouses', {}),
    (error) => isNovaPoshtaTransientError(error),
  )
})
