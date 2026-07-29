import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isOnlinePaymentAvailableForShippingMethod,
  resolveCheckoutPaymentMethod,
  resolveInstallmentPaytype,
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

test('installments resolve to a stored LIQPAY payment method', () => {
  assert.equal(
    resolveCheckoutPaymentMethod('LIQPAY_PAYPART', 'nova_poshta'),
    'LIQPAY',
  )
})

test('installment paytype is paypart only for online (Nova Poshta) checkout', () => {
  assert.equal(
    resolveInstallmentPaytype('LIQPAY_PAYPART', 'nova_poshta'),
    'paypart',
  )
  // Not an installment choice
  assert.equal(resolveInstallmentPaytype('LIQPAY', 'nova_poshta'), null)
  assert.equal(resolveInstallmentPaytype('BANK_TRANSFER', 'nova_poshta'), null)
  // Installments never apply to international checkout
  assert.equal(
    resolveInstallmentPaytype('LIQPAY_PAYPART', 'international_address'),
    null,
  )
})
