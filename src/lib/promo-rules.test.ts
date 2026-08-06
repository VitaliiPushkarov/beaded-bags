import test from 'node:test'
import assert from 'node:assert/strict'

import {
  calcPromoDiscountUAH,
  evaluatePromo,
  normalizePromoCode,
  describePromoRejection,
  type PromoRecord,
} from './promo-rules'

const NOW = new Date('2026-08-06T12:00:00Z')

function buildPromo(overrides: Partial<PromoRecord> = {}): PromoRecord {
  return {
    code: 'SPECIAL',
    discountPercent: 10,
    isActive: true,
    startsAt: null,
    endsAt: null,
    minOrderUAH: 0,
    usageLimit: null,
    usedCount: 0,
    ...overrides,
  }
}

test('codes are compared case- and whitespace-insensitively', () => {
  assert.equal(normalizePromoCode('  special '), 'SPECIAL')
  assert.equal(normalizePromoCode('GeRdAn10'), 'GERDAN10')
  assert.equal(normalizePromoCode(null), '')
})

test('the discount is a rounded percentage of the subtotal', () => {
  assert.equal(calcPromoDiscountUAH(4200, 10), 420)
  assert.equal(calcPromoDiscountUAH(999, 10), 100)
  assert.equal(calcPromoDiscountUAH(0, 10), 0)
})

test('a discount can never exceed the order or go negative', () => {
  assert.equal(calcPromoDiscountUAH(1000, 150), 1000)
  assert.equal(calcPromoDiscountUAH(1000, -10), 0)
  assert.equal(calcPromoDiscountUAH(-500, 10), 0)
  assert.equal(calcPromoDiscountUAH(1000, Number.NaN), 0)
})

test('a valid code returns its discount', () => {
  const result = evaluatePromo(buildPromo(), { subtotalUAH: 4200, now: NOW })
  assert.deepEqual(result, {
    ok: true,
    code: 'SPECIAL',
    discountPercent: 10,
    discountUAH: 420,
  })
})

test('an unknown code is rejected', () => {
  assert.deepEqual(evaluatePromo(null, { subtotalUAH: 4200, now: NOW }), {
    ok: false,
    reason: 'not_found',
  })
})

test('a switched-off code is rejected', () => {
  const result = evaluatePromo(buildPromo({ isActive: false }), {
    subtotalUAH: 4200,
    now: NOW,
  })
  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.reason, 'inactive')
})

test('a code outside its validity window is rejected', () => {
  const notStarted = evaluatePromo(
    buildPromo({ startsAt: new Date('2026-09-01T00:00:00Z') }),
    { subtotalUAH: 4200, now: NOW },
  )
  assert.equal(notStarted.ok === false && notStarted.reason, 'not_started')

  const expired = evaluatePromo(
    buildPromo({ endsAt: new Date('2026-08-01T00:00:00Z') }),
    { subtotalUAH: 4200, now: NOW },
  )
  assert.equal(expired.ok === false && expired.reason, 'expired')
})

test('a code inside its validity window is accepted', () => {
  const result = evaluatePromo(
    buildPromo({
      startsAt: new Date('2026-08-01T00:00:00Z'),
      endsAt: new Date('2026-08-31T23:59:59Z'),
    }),
    { subtotalUAH: 4200, now: NOW },
  )
  assert.equal(result.ok, true)
})

test('a fully redeemed code is rejected', () => {
  const result = evaluatePromo(buildPromo({ usageLimit: 5, usedCount: 5 }), {
    subtotalUAH: 4200,
    now: NOW,
  })
  assert.equal(result.ok === false && result.reason, 'usage_limit_reached')
})

test('a code with remaining uses is accepted', () => {
  const result = evaluatePromo(buildPromo({ usageLimit: 5, usedCount: 4 }), {
    subtotalUAH: 4200,
    now: NOW,
  })
  assert.equal(result.ok, true)
})

test('an unlimited code never runs out', () => {
  const result = evaluatePromo(
    buildPromo({ usageLimit: null, usedCount: 9999 }),
    { subtotalUAH: 4200, now: NOW },
  )
  assert.equal(result.ok, true)
})

test('a minimum order value is enforced and reported', () => {
  const result = evaluatePromo(buildPromo({ minOrderUAH: 2000 }), {
    subtotalUAH: 1500,
    now: NOW,
  })

  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.reason, 'below_min_order')
  assert.equal(result.ok === false && result.minOrderUAH, 2000)

  // The message tells the shopper the threshold rather than just "invalid".
  if (result.ok === false) {
    assert.match(describePromoRejection(result, 'uk'), /2000/)
    assert.match(describePromoRejection(result, 'en'), /2000/)
  }
})

test('an order exactly at the minimum qualifies', () => {
  const result = evaluatePromo(buildPromo({ minOrderUAH: 2000 }), {
    subtotalUAH: 2000,
    now: NOW,
  })
  assert.equal(result.ok, true)
})

test('rejection messages exist in both languages', () => {
  for (const reason of [
    'not_found',
    'inactive',
    'not_started',
    'expired',
    'usage_limit_reached',
  ] as const) {
    const evaluation = { ok: false as const, reason }
    assert.ok(describePromoRejection(evaluation, 'uk').length > 0)
    assert.ok(describePromoRejection(evaluation, 'en').length > 0)
  }
})
