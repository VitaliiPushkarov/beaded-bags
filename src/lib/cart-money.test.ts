import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getCartItemUnitPrice,
  resolveCartDisplayCurrency,
  sumCartDisplayAmount,
} from './cart-money'
import { convertOptionPriceFromUAH } from './localized-product'

test('cart uses USD display only when every item has USD price', () => {
  assert.equal(
    resolveCartDisplayCurrency({
      locale: 'en',
      items: [{ priceUSD: 120 }, { priceUSD: 80 }],
    }),
    'USD',
  )

  assert.equal(
    resolveCartDisplayCurrency({
      locale: 'en',
      items: [{ priceUSD: 120 }, { priceUSD: null }],
    }),
    'UAH',
  )
})

test('cart display total uses the resolved currency prices', () => {
  const items = [
    { priceUAH: 4000, priceUSD: 100, qty: 2 },
    { priceUAH: 1200, priceUSD: 30, qty: 1 },
  ]

  assert.equal(sumCartDisplayAmount(items, 'USD'), 230)
  assert.equal(sumCartDisplayAmount(items, 'UAH'), 9200)
  assert.equal(getCartItemUnitPrice(items[0], 'USD'), 100)
  assert.equal(getCartItemUnitPrice(items[0], 'UAH'), 4000)
})

test('option extra price can be derived in USD from variant price ratio', () => {
  assert.equal(
    convertOptionPriceFromUAH({
      extraPriceUAH: 400,
      targetCurrency: 'USD',
      referencePriceUAH: 4000,
      referencePriceUSD: 100,
    }),
    10,
  )

  assert.equal(
    convertOptionPriceFromUAH({
      extraPriceUAH: 400,
      targetCurrency: 'UAH',
      referencePriceUAH: 4000,
      referencePriceUSD: 100,
    }),
    400,
  )
})
