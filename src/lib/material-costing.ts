// Moving weighted-average unit cost for material stock intake.
// When new stock arrives at a given unit price, the material's unit cost
// becomes the quantity-weighted blend of existing and incoming stock. Shared
// by the bulk material import and the per-material "receive stock" action so
// both stay consistent.
export function buildNextMaterialUnitCostUAH(input: {
  currentStockQty: number
  currentUnitCostUAH: number
  incomingStockQty: number
  incomingUnitCostUAH: number
}): number {
  const currentStockQty = Math.max(0, input.currentStockQty)
  const currentUnitCostUAH = Math.max(0, input.currentUnitCostUAH)
  const incomingStockQty = Math.max(0, input.incomingStockQty)
  const incomingUnitCostUAH = Math.max(0, input.incomingUnitCostUAH)

  if (incomingStockQty > 0 && incomingUnitCostUAH > 0) {
    const nextStockQty = currentStockQty + incomingStockQty
    if (nextStockQty > 0) {
      return (
        (currentStockQty * currentUnitCostUAH +
          incomingStockQty * incomingUnitCostUAH) /
        nextStockQty
      )
    }
  }

  // Incoming quantity with no (or zero) price keeps the current unit cost;
  // a price-only update (no quantity) sets the unit cost directly.
  if (incomingStockQty === 0 && incomingUnitCostUAH > 0) {
    return incomingUnitCostUAH
  }

  return currentUnitCostUAH
}
