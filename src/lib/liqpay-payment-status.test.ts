import assert from 'node:assert/strict'
import test from 'node:test'

import {
  mapLiqPayOrderStatus,
  verifyLiqPayPaidAmount,
} from './liqpay-payment-status'

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

test('a payment matching the order total verifies', () => {
  assert.deepEqual(
    verifyLiqPayPaidAmount({ amount: 4200, currency: 'UAH' }, 4200),
    { status: 'ok' },
  )
  // LiqPay may send the amount as a float or a string.
  assert.deepEqual(
    verifyLiqPayPaidAmount({ amount: '4200.00', currency: 'uah' }, 4200),
    { status: 'ok' },
  )
})

test('an underpaid order is a mismatch, not a success', () => {
  assert.deepEqual(
    verifyLiqPayPaidAmount({ amount: 1, currency: 'UAH' }, 4200),
    {
      status: 'mismatch',
      paidAmountUAH: 1,
      paidCurrency: 'uah',
      expectedUAH: 4200,
    },
  )
})

test('the right number in the wrong currency is a mismatch', () => {
  const result = verifyLiqPayPaidAmount({ amount: 4200, currency: 'USD' }, 4200)
  assert.equal(result.status, 'mismatch')
})

test('a missing amount is unverifiable rather than a mismatch', () => {
  // An optional field must never block a genuine payment.
  assert.equal(
    verifyLiqPayPaidAmount({ currency: 'UAH' }, 4200).status,
    'unverifiable',
  )
  assert.equal(
    verifyLiqPayPaidAmount({ amount: 'not-a-number', currency: 'UAH' }, 4200)
      .status,
    'unverifiable',
  )
  assert.equal(
    verifyLiqPayPaidAmount({ amount: 4200 }, 4200).status,
    'unverifiable',
  )
})
