import { revalidatePath } from 'next/cache'
import type { Prisma, ProductGroup, ProductStatus, ProductType } from '@prisma/client'

import {
  deriveTrackedAvailabilityStatus,
  groupOrderVariantQuantities,
  isInventorySettledOrderStatus,
  normalizeInventoryQuantity,
} from '@/lib/inventory-status'
import { prisma } from '@/lib/prisma'
import { revalidateProductCache } from '@/lib/revalidate-products'

const INVENTORY_REVALIDATE_PATHS = [
  '/admin',
  '/admin/orders',
  '/admin/finance',
  '/admin/inventory',
  '/admin/inventory/products',
  '/admin/configuration',
] as const

const PRODUCT_SNAPSHOT_SELECT = {
  id: true,
  slug: true,
  type: true,
  group: true,
  status: true,
} satisfies Prisma.ProductSelect

type InventoryDbClient = Prisma.TransactionClient

export type InventorySettlementProductSnapshot = {
  id: string
  slug: string
  type: ProductType
  group: ProductGroup | null
  status: ProductStatus
}

export type PaidOrderInventoryResult = {
  applied: boolean
  affectedProductIds: string[]
  productSnapshots: InventorySettlementProductSnapshot[]
}

async function loadVariantInventoryState(
  tx: InventoryDbClient,
  variantId: string,
) {
  return tx.productVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      productId: true,
      inStock: true,
      availabilityStatus: true,
      inventory: {
        select: {
          finishedGoodsQty: true,
        },
      },
    },
  })
}

async function loadProductSnapshots(
  tx: InventoryDbClient,
  productIds: string[],
): Promise<InventorySettlementProductSnapshot[]> {
  if (productIds.length === 0) return []

  return tx.product.findMany({
    where: { id: { in: productIds } },
    select: PRODUCT_SNAPSHOT_SELECT,
  })
}

async function syncProductInStockFromVariants(
  tx: InventoryDbClient,
  productId: string,
) {
  const inStockVariants = await tx.productVariant.count({
    where: {
      productId,
      availabilityStatus: 'IN_STOCK',
    },
  })

  await tx.product.update({
    where: { id: productId },
    data: {
      inStock: inStockVariants > 0,
    },
  })
}

async function syncVariantAvailabilityForCurrentInventory(
  tx: InventoryDbClient,
  variantId: string,
) {
  const variant = await loadVariantInventoryState(tx, variantId)
  if (!variant) return null

  const nextQty = normalizeInventoryQuantity(
    variant.inventory?.finishedGoodsQty ?? 0,
  )
  const nextStatus = deriveTrackedAvailabilityStatus({
    currentStatus: variant.availabilityStatus,
    nextQty,
  })
  const nextInStock = nextStatus === 'IN_STOCK'

  if (
    variant.availabilityStatus !== nextStatus ||
    variant.inStock !== nextInStock
  ) {
    await tx.productVariant.update({
      where: { id: variant.id },
      data: {
        availabilityStatus: nextStatus,
        inStock: nextInStock,
      },
    })
  }

  return {
    productId: variant.productId,
  }
}

// Apply an exact signed change to a tracked variant's finished-goods stock.
// deltaQty is negative for a sale (settlement) and positive for a reversal, so
// the two are perfectly symmetric — a settled-then-cancelled order nets to
// zero. Only variants that already have an inventory row are moved; untracked
// (made-to-order / preorder) variants have no finished-goods stock and are
// skipped. Stock is allowed to go negative so oversells stay visible instead
// of being silently clamped.
async function applyVariantInventoryDelta(
  tx: InventoryDbClient,
  variantId: string,
  deltaQty: number,
) {
  const variant = await loadVariantInventoryState(tx, variantId)
  if (!variant) {
    console.warn(
      `[inventory] Order item references missing variant "${variantId}"`,
    )
    return null
  }

  if (!variant.inventory) {
    // Untracked variant — no finished-goods stock to move.
    return variant.productId
  }

  const safeDelta = Math.trunc(Number(deltaQty) || 0)
  if (safeDelta !== 0) {
    await tx.productVariantInventory.update({
      where: { variantId },
      data: {
        finishedGoodsQty: {
          increment: safeDelta,
        },
      },
    })
  }

  await syncVariantAvailabilityForCurrentInventory(tx, variantId)

  return variant.productId
}

export async function applyPaidOrderInventoryTx(
  tx: InventoryDbClient,
  orderId: string,
): Promise<PaidOrderInventoryResult> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      inventoryAppliedAt: true,
      items: {
        select: {
          variantId: true,
          qty: true,
        },
      },
    },
  })

  if (!order || !isInventorySettledOrderStatus(order.status)) {
    return {
      applied: false,
      affectedProductIds: [],
      productSnapshots: [],
    }
  }

  if (order.inventoryAppliedAt) {
    return {
      applied: false,
      affectedProductIds: [],
      productSnapshots: [],
    }
  }

  const marked = await tx.order.updateMany({
    where: {
      id: order.id,
      inventoryAppliedAt: null,
    },
    data: {
      inventoryAppliedAt: new Date(),
    },
  })

  if (marked.count === 0) {
    return {
      applied: false,
      affectedProductIds: [],
      productSnapshots: [],
    }
  }

  const groupedItems = groupOrderVariantQuantities(order.items)
  const affectedProductIds = new Set<string>()

  for (const item of groupedItems) {
    const productId = await applyVariantInventoryDelta(
      tx,
      item.variantId,
      -item.qty,
    )

    if (productId) {
      affectedProductIds.add(productId)
    }
  }

  const productIds = Array.from(affectedProductIds)

  for (const productId of productIds) {
    await syncProductInStockFromVariants(tx, productId)
  }

  return {
    applied: true,
    affectedProductIds: productIds,
    productSnapshots: await loadProductSnapshots(tx, productIds),
  }
}

// Undo a previously-applied settlement: restore finished-goods stock and clear
// inventoryAppliedAt so the order can be settled again later. Only runs when
// inventory was applied and the order is no longer in a settled state
// (e.g. PAID/FULFILLED -> CANCELLED/FAILED/PENDING). Idempotent.
export async function reversePaidOrderInventoryTx(
  tx: InventoryDbClient,
  orderId: string,
): Promise<PaidOrderInventoryResult> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      inventoryAppliedAt: true,
      items: {
        select: {
          variantId: true,
          qty: true,
        },
      },
    },
  })

  const notApplied: PaidOrderInventoryResult = {
    applied: false,
    affectedProductIds: [],
    productSnapshots: [],
  }

  if (!order || !order.inventoryAppliedAt) return notApplied
  // Still in a settled state — nothing to reverse.
  if (isInventorySettledOrderStatus(order.status)) return notApplied

  const cleared = await tx.order.updateMany({
    where: {
      id: order.id,
      inventoryAppliedAt: { not: null },
    },
    data: {
      inventoryAppliedAt: null,
    },
  })

  if (cleared.count === 0) return notApplied

  const groupedItems = groupOrderVariantQuantities(order.items)
  const affectedProductIds = new Set<string>()

  for (const item of groupedItems) {
    const productId = await applyVariantInventoryDelta(
      tx,
      item.variantId,
      item.qty,
    )

    if (productId) {
      affectedProductIds.add(productId)
    }
  }

  const productIds = Array.from(affectedProductIds)

  for (const productId of productIds) {
    await syncProductInStockFromVariants(tx, productId)
  }

  return {
    applied: true,
    affectedProductIds: productIds,
    productSnapshots: await loadProductSnapshots(tx, productIds),
  }
}

export function revalidateInventoryProductViews(
  productSnapshots: InventorySettlementProductSnapshot[],
) {
  for (const path of INVENTORY_REVALIDATE_PATHS) {
    revalidatePath(path)
  }

  for (const snapshot of productSnapshots) {
    revalidateProductCache({
      reason: 'update',
      before: snapshot,
      after: snapshot,
    })
  }
}

export async function updateVariantInventoryQuantity(input: {
  variantId: string
  finishedGoodsQty: number
  notes?: string | null
}) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.productVariantInventory.upsert({
      where: { variantId: input.variantId },
      create: {
        variantId: input.variantId,
        finishedGoodsQty: normalizeInventoryQuantity(input.finishedGoodsQty),
        notes: input.notes || null,
      },
      update: {
        finishedGoodsQty: normalizeInventoryQuantity(input.finishedGoodsQty),
        notes: input.notes || null,
      },
    })

    const synced = await syncVariantAvailabilityForCurrentInventory(
      tx,
      input.variantId,
    )

    if (!synced) return null

    await syncProductInStockFromVariants(tx, synced.productId)

    return {
      productSnapshots: await loadProductSnapshots(tx, [synced.productId]),
    }
  })

  if (!result) return null

  revalidateInventoryProductViews(result.productSnapshots)

  return result
}
