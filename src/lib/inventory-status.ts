import type { AvailabilityStatus, OrderStatus } from '@prisma/client'

type VariantOrderItemLike = {
  variantId?: string | null
  qty: number
}

export function normalizeInventoryQuantity(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.trunc(value))
}

export function deriveTrackedAvailabilityStatus(input: {
  currentStatus: AvailabilityStatus
  nextQty: number
}): AvailabilityStatus {
  if (input.currentStatus === 'OUT_OF_STOCK') return 'OUT_OF_STOCK'
  return normalizeInventoryQuantity(input.nextQty) > 0 ? 'IN_STOCK' : 'PREORDER'
}

export function isInventorySettledOrderStatus(status: OrderStatus): boolean {
  return status === 'PAID' || status === 'FULFILLED'
}

export function groupOrderVariantQuantities(
  items: readonly VariantOrderItemLike[],
): Array<{ variantId: string; qty: number }> {
  const grouped = new Map<string, number>()

  for (const item of items) {
    const variantId = String(item.variantId ?? '').trim()
    const qty = normalizeInventoryQuantity(item.qty)

    if (!variantId || qty <= 0) continue

    grouped.set(variantId, (grouped.get(variantId) ?? 0) + qty)
  }

  return Array.from(grouped, ([variantId, qty]) => ({ variantId, qty }))
}
