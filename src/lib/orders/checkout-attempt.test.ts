import test from 'node:test'
import assert from 'node:assert/strict'

import { buildCheckoutAttemptFingerprint } from './checkout-attempt'

test('buildCheckoutAttemptFingerprint is stable for equivalent payloads', () => {
  const first = buildCheckoutAttemptFingerprint({
    amountUAH: 2500,
    paymentMethod: 'LIQPAY',
    customerPhone: '380501112233',
    cityRef: 'city-ref',
    warehouseRef: 'warehouse-ref',
    promoCode: 'WELCOME',
    items: [
      {
        productId: 'product-1',
        variantId: 'variant-1',
        qty: 1,
        priceUAH: 2500,
        color: 'red',
        modelSize: 'S',
        pouchColor: 'black',
        strapName: 'chain',
        addons: [{ addonVariantId: 'addon-1', qty: 1, priceUAH: 300 }],
      },
    ],
  })

  const second = buildCheckoutAttemptFingerprint({
    amountUAH: 2500,
    paymentMethod: 'LIQPAY',
    customerPhone: '380501112233',
    cityRef: 'city-ref',
    warehouseRef: 'warehouse-ref',
    promoCode: 'WELCOME',
    items: [
      {
        productId: 'product-1',
        variantId: 'variant-1',
        qty: 1,
        priceUAH: 2500,
        color: 'red',
        modelSize: 'S',
        pouchColor: 'black',
        strapName: 'chain',
        addons: [{ addonVariantId: 'addon-1', qty: 1, priceUAH: 300 }],
      },
    ],
  })

  assert.equal(first, second)
})

test('buildCheckoutAttemptFingerprint changes when checkout payload changes', () => {
  const first = buildCheckoutAttemptFingerprint({
    amountUAH: 2500,
    paymentMethod: 'LIQPAY',
    customerPhone: '380501112233',
    cityRef: 'city-ref',
    warehouseRef: 'warehouse-ref',
    items: [
      {
        productId: 'product-1',
        variantId: 'variant-1',
        qty: 1,
        priceUAH: 2500,
      },
    ],
  })

  const second = buildCheckoutAttemptFingerprint({
    amountUAH: 5000,
    paymentMethod: 'LIQPAY',
    customerPhone: '380501112233',
    cityRef: 'city-ref',
    warehouseRef: 'warehouse-ref',
    items: [
      {
        productId: 'product-1',
        variantId: 'variant-1',
        qty: 2,
        priceUAH: 2500,
      },
    ],
  })

  assert.notEqual(first, second)
})
