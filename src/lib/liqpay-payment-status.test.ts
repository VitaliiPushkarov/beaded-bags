import assert from 'node:assert/strict'
import test from 'node:test'

import { mapLiqPayOrderStatus } from './liqpay-payment-status'

test('mapLiqPayOrderStatus treats successful settlement statuses as paid', () => {
  assert.equal(mapLiqPayOrderStatus({ status: 'success' }), 'PAID')
  assert.equal(mapLiqPayOrderStatus({ status: 'sandbox' }), 'PAID')
  assert.equal(mapLiqPayOrderStatus({ status: 'wait_accept' }), 'PAID')
  assert.equal(mapLiqPayOrderStatus({ status: 'wait_compensation' }), 'PAID')
})

test('mapLiqPayOrderStatus keeps non-final review statuses pending', () => {
  assert.equal(mapLiqPayOrderStatus({ status: 'prepared' }), null)
  assert.equal(mapLiqPayOrderStatus({ status: 'processing' }), null)
  assert.equal(mapLiqPayOrderStatus({ status: 'wait_secure' }), null)
})

test('mapLiqPayOrderStatus detects cancellations separately from failures', () => {
  assert.equal(
    mapLiqPayOrderStatus({
      status: 'failure',
      err_description: 'Платіж скасовано клієнтом',
    }),
    'CANCELLED',
  )
  assert.equal(
    mapLiqPayOrderStatus({
      status: 'failure',
      err_description: 'Недостатньо коштів',
      transaction_id: 'tx-123',
    }),
    'FAILED',
  )
  assert.equal(
    mapLiqPayOrderStatus({
      status: 'failure',
    }),
    'CANCELLED',
  )
})
