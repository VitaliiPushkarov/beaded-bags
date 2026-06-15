import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isOnlinePaymentAvailableForShippingMethod,
  resolveCheckoutPaymentMethod,
} from './payment-methods'

test('online payment is available for Nova Poshta checkout', () => {
  assert.equal(isOnlinePaymentAvailableForShippingMethod('nova_poshta'), true)
})

test('online payment is hidden for international checkout', () => {
  assert.equal(
    isOnlinePaymentAvailableForShippingMethod('international_address'),
    false,
  )
})

test('international checkout always resolves to bank transfer', () => {
  assert.equal(
    resolveCheckoutPaymentMethod('LIQPAY', 'international_address'),
    'BANK_TRANSFER',
  )
  assert.equal(
    resolveCheckoutPaymentMethod(undefined, 'international_address'),
    'BANK_TRANSFER',
  )
})

test('nova poshta checkout preserves selected payment method', () => {
  assert.equal(resolveCheckoutPaymentMethod('LIQPAY', 'nova_poshta'), 'LIQPAY')
  assert.equal(
    resolveCheckoutPaymentMethod('BANK_TRANSFER', 'nova_poshta'),
    'BANK_TRANSFER',
  )
})
