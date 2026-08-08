import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildLiqPayRroInfo,
  LiqPayFiscalConfigError,
  LiqPayFiscalTotalError,
} from './liqpay-rro'

type BuildArgs = Parameters<typeof buildLiqPayRroInfo>[0]

function baseArgs(overrides: Partial<BuildArgs> = {}): BuildArgs {
  return {
    items: [],
    variantsById: new Map(),
    strapsById: new Map(),
    pouchesById: new Map(),
    sizesById: new Map(),
    ...overrides,
  }
}

function variant(id: string, liqpayGoodId: number | null) {
  return new Map([[id, { id, liqpayGoodId }]])
}

function assertLinesAreExact(items: Array<{ amount: number; price: number; cost: number }>) {
  for (const item of items) {
    assert.equal(
      Math.round(item.cost * 100),
      Math.round(item.price * 100) * item.amount,
      `cost must equal price * amount for ${JSON.stringify(item)}`,
    )
  }
}

function totalOf(items: Array<{ cost: number }>) {
  return Math.round(items.reduce((sum, item) => sum + item.cost, 0) * 100) / 100
}

test('a promo-discounted single item is fiscalized at the price actually charged', () => {
  // Order #201: Candy bag listed at 1990, promo SPECIAL -10%, charged 1791.
  const info = buildLiqPayRroInfo(
    baseArgs({
      items: [
        {
          name: 'Сумка Candy',
          qty: 1,
          priceUAH: 1990,
          discountUAH: 199,
          lineRevenueUAH: 1791,
          variantId: 'candy',
        },
      ],
      variantsById: variant('candy', 29079215),
      expectedTotalUAH: 1791,
    }),
  )

  assert.deepEqual(info.items, [
    { id: 29079215, amount: 1, price: 1791, cost: 1791 },
  ])
})

test('a discount that does not divide evenly still totals the charged amount', () => {
  // 7 x 1599 = 11193, less a 1119 promo = 10074 charged (order money is whole
  // hryvnia). Per unit that is 1439.142857…, which cannot be written as a single
  // fiscal line without the receipt drifting from the payment.
  const info = buildLiqPayRroInfo(
    baseArgs({
      items: [
        {
          name: 'Cozy x7',
          qty: 7,
          priceUAH: 1599,
          discountUAH: 1119,
          lineRevenueUAH: 10074,
          variantId: 'cozy',
        },
      ],
      variantsById: variant('cozy', 27778532),
      expectedTotalUAH: 10074,
    }),
  )

  assertLinesAreExact(info.items)
  assert.equal(totalOf(info.items), 10074)
  assert.equal(
    info.items.reduce((sum, item) => sum + item.amount, 0),
    7,
    'every unit bought must appear on the receipt exactly once',
  )
  assert.deepEqual(info.items, [
    { id: 27778532, amount: 5, price: 1439.14, cost: 7195.7 },
    { id: 27778532, amount: 2, price: 1439.15, cost: 2878.3 },
  ])
})

test('an evenly divisible line stays a single fiscal line', () => {
  const info = buildLiqPayRroInfo(
    baseArgs({
      items: [
        {
          name: 'Брелок x3',
          qty: 3,
          priceUAH: 400,
          discountUAH: 120,
          lineRevenueUAH: 1080,
          variantId: 'brelok',
        },
      ],
      variantsById: variant('brelok', 111),
      expectedTotalUAH: 1080,
    }),
  )

  assert.deepEqual(info.items, [{ id: 111, amount: 3, price: 360, cost: 1080 }])
})

test('options are fiscalized as their own catalogue goods', () => {
  const info = buildLiqPayRroInfo(
    baseArgs({
      items: [
        {
          name: 'Classic Mini',
          qty: 1,
          priceUAH: 2520,
          discountUAH: 0,
          lineRevenueUAH: 2520,
          variantId: 'classic',
          strapId: 'strap',
        },
      ],
      variantsById: variant('classic', 27803609),
      strapsById: new Map([
        ['strap', { id: 'strap', name: 'Ланцюжок', extraPriceUAH: 420, liqpayGoodId: 555 }],
      ]),
      expectedTotalUAH: 2520,
    }),
  )

  assertLinesAreExact(info.items)
  assert.equal(totalOf(info.items), 2520)
  assert.deepEqual(info.items, [
    { id: 27803609, amount: 1, price: 2100, cost: 2100 },
    { id: 555, amount: 1, price: 420, cost: 420 },
  ])
})

test('a receipt that would not total the charged amount is refused', () => {
  assert.throws(
    () =>
      buildLiqPayRroInfo(
        baseArgs({
          items: [
            {
              name: 'Сумка',
              qty: 1,
              priceUAH: 1990,
              discountUAH: 0,
              lineRevenueUAH: 1990,
              variantId: 'candy',
            },
          ],
          variantsById: variant('candy', 29079215),
          // Delivery, a partial payment, anything that makes the money taken
          // differ from the lines: fiscalization would fail after the charge.
          expectedTotalUAH: 2090,
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof LiqPayFiscalTotalError)
      assert.equal(error.fiscalTotalUAH, 1990)
      assert.equal(error.expectedTotalUAH, 2090)
      return true
    },
  )
})

test('an item with no catalogue good ID is refused by name', () => {
  assert.throws(
    () =>
      buildLiqPayRroInfo(
        baseArgs({
          items: [
            {
              name: 'Сумка без ID',
              qty: 1,
              priceUAH: 1000,
              discountUAH: 0,
              lineRevenueUAH: 1000,
              variantId: 'no-id',
            },
          ],
          variantsById: variant('no-id', null),
          expectedTotalUAH: 1000,
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof LiqPayFiscalConfigError)
      assert.equal(error.itemLabel, 'Сумка без ID')
      assert.equal(error.catalogCode, 'vrn-no-id')
      return true
    },
  )
})
