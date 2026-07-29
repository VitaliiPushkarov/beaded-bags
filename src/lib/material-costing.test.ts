import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildNextMaterialUnitCostUAH } from './material-costing'

test('first intake sets the unit cost to the incoming price', () => {
  const next = buildNextMaterialUnitCostUAH({
    currentStockQty: 0,
    currentUnitCostUAH: 0,
    incomingStockQty: 100,
    incomingUnitCostUAH: 3,
  })
  assert.equal(next, 3)
})

test('restock blends the unit cost as a quantity-weighted average', () => {
  // 10 @ 5 + 10 @ 15 -> 200 / 20 = 10
  const next = buildNextMaterialUnitCostUAH({
    currentStockQty: 10,
    currentUnitCostUAH: 5,
    incomingStockQty: 10,
    incomingUnitCostUAH: 15,
  })
  assert.equal(next, 10)
})

test('uneven quantities weight toward the larger lot', () => {
  // 90 @ 2 + 10 @ 12 -> (180 + 120) / 100 = 3
  const next = buildNextMaterialUnitCostUAH({
    currentStockQty: 90,
    currentUnitCostUAH: 2,
    incomingStockQty: 10,
    incomingUnitCostUAH: 12,
  })
  assert.equal(next, 3)
})

test('incoming quantity with no price keeps the current unit cost', () => {
  const next = buildNextMaterialUnitCostUAH({
    currentStockQty: 10,
    currentUnitCostUAH: 7,
    incomingStockQty: 5,
    incomingUnitCostUAH: 0,
  })
  assert.equal(next, 7)
})
