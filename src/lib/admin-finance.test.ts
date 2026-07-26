import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildFinanceProductResolver,
  resolveOrderFinance,
  type FinanceOrder,
} from '@/lib/admin-finance'

test('resolveOrderFinance prefers variant-specific unit cost from resolver', () => {
  const resolver = buildFinanceProductResolver({
    products: [
      {
        id: 'product_1',
        name: 'Сумка',
        slug: 'sumka',
        unitCostUAH: 700,
      },
    ],
    variants: [
      {
        id: 'variant_1',
        unitCostUAH: 500,
      },
    ],
  })

  const order = {
    status: 'PAID',
    subtotalUAH: 1200,
    discountUAH: 0,
    totalUAH: 1200,
    itemsCostUAH: 0,
    paymentFeeUAH: 0,
    paymentMethod: 'BANK_TRANSFER',
    items: [
      {
        productId: 'product_1',
        variantId: 'variant_1',
        name: 'Сумка',
        color: 'Чорний',
        modelSize: null,
        pouchColor: null,
        strapName: null,
        qty: 1,
        priceUAH: 1200,
        lineRevenueUAH: 0,
        unitCostUAH: 0,
        totalCostUAH: 0,
      },
    ],
  } as FinanceOrder

  const resolved = resolveOrderFinance(order, resolver)

  assert.equal(resolved.itemsCostUAH, 500)
  assert.equal(resolved.lines[0]?.unitCostUAH, 500)
  assert.equal(resolved.lines[0]?.totalCostUAH, 500)
})

test('resolveOrderFinance trusts a modern order zero-cost snapshot (no retroactive recompute)', () => {
  const resolver = buildFinanceProductResolver({
    products: [{ id: 'product_1', name: 'Сумка', slug: 'sumka', unitCostUAH: 700 }],
    variants: [{ id: 'variant_1', unitCostUAH: 500 }],
  })

  const order = {
    createdAt: new Date('2026-06-01T00:00:00.000Z'), // after the snapshot cutoff
    status: 'PAID',
    subtotalUAH: 1200,
    discountUAH: 0,
    totalUAH: 1200,
    itemsCostUAH: 0,
    paymentFeeUAH: 0,
    paymentMethod: 'BANK_TRANSFER',
    items: [
      {
        productId: 'product_1',
        variantId: 'variant_1',
        name: 'Сумка',
        color: 'Чорний',
        modelSize: null,
        pouchColor: null,
        strapName: null,
        qty: 1,
        priceUAH: 1200,
        lineRevenueUAH: 1200,
        unitCostUAH: 0,
        totalCostUAH: 0,
      },
    ],
  } as FinanceOrder

  const resolved = resolveOrderFinance(order, resolver)

  // Snapshot is authoritative: cost stays 0, not recomputed to 500.
  assert.equal(resolved.itemsCostUAH, 0)
  assert.equal(resolved.lines[0]?.unitCostUAH, 0)
  assert.equal(resolved.grossProfitUAH, 1200)
})
