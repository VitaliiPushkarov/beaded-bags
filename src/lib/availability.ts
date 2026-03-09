import type { AvailabilityStatus } from '@prisma/client'

type AvailabilityInput = {
  availabilityStatus?: AvailabilityStatus | null
  inStock?: boolean | null
}

export function resolveAvailabilityStatus(
  input: AvailabilityInput,
): AvailabilityStatus {
  if (input.availabilityStatus) return input.availabilityStatus
  return input.inStock ? 'IN_STOCK' : 'PREORDER'
}

export function isInStockStatus(status: AvailabilityStatus) {
  return status === 'IN_STOCK'
}

export function isPreorderStatus(status: AvailabilityStatus) {
  return status === 'PREORDER'
}

export function isOutOfStockStatus(status: AvailabilityStatus) {
  return status === 'OUT_OF_STOCK'
}

export function toSchemaOrgAvailability(status: AvailabilityStatus) {
  if (status === 'IN_STOCK') return 'https://schema.org/InStock'
  if (status === 'PREORDER') return 'https://schema.org/PreOrder'
  return 'https://schema.org/OutOfStock'
}
