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

async function decrementVariantInventoryOnSale(
  tx: InventoryDbClient,
  variantId: string,
  qty: number,
) {
  const variant = await loadVariantInventoryState(tx, variantId)
  if (!variant) {
    console.warn(
      `[inventory] Paid order item references missing variant "${variantId}"`,
    )
    return null
  }

  const safeQty = normalizeInventoryQuantity(qty)
  if (safeQty <= 0) return variant.productId

  const decremented = await tx.productVariantInventory.updateMany({
    where: {
      variantId,
      finishedGoodsQty: {
        gte: safeQty,
      },
    },
    data: {
      finishedGoodsQty: {
        decrement: safeQty,
      },
    },
  })

  if (decremented.count === 0) {
    await tx.productVariantInventory.upsert({
      where: { variantId },
      create: {
        variantId,
        finishedGoodsQty: 0,
      },
      update: {
        finishedGoodsQty: 0,
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
    const productId = await decrementVariantInventoryOnSale(
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
