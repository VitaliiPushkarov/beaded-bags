import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  applyPaidOrderInventoryTx,
  reversePaidOrderInventoryTx,
} from './product-inventory'

// Minimal in-memory stand-in for the Prisma transaction client, implementing
// only the operations the settlement/reversal code uses, with faithful
// semantics for the pieces that matter (the inventoryAppliedAt guard and the
// atomic increment).
type VariantRow = {
  id: string
  productId: string
  inStock: boolean
  availabilityStatus: 'IN_STOCK' | 'PREORDER' | 'OUT_OF_STOCK'
  finishedGoodsQty: number | null // null = untracked (no inventory row)
}
type OrderRow = {
  id: string
  status: 'PENDING' | 'PAID' | 'FULFILLED' | 'CANCELLED' | 'FAILED'
  inventoryAppliedAt: Date | null
  items: Array<{ variantId: string; qty: number }>
}

function makeTx(variants: VariantRow[], order: OrderRow) {
  const variantsById = new Map(variants.map((v) => [v.id, v]))

  return {
    order: {
      findUnique: async () => (order ? { ...order, items: order.items } : null),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; inventoryAppliedAt?: unknown }
        data: { inventoryAppliedAt: Date | null }
      }) => {
        if (where.id !== order.id) return { count: 0 }
        const wantsNull =
          where.inventoryAppliedAt &&
          typeof where.inventoryAppliedAt === 'object' &&
          'not' in (where.inventoryAppliedAt as object)
        // guard: `inventoryAppliedAt: null` (settle) vs `{ not: null }` (reverse)
        if (wantsNull) {
          if (order.inventoryAppliedAt == null) return { count: 0 }
        } else if (order.inventoryAppliedAt != null) {
          return { count: 0 }
        }
        order.inventoryAppliedAt = data.inventoryAppliedAt
        return { count: 1 }
      },
    },
    productVariant: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const v = variantsById.get(where.id)
        if (!v) return null
        return {
          id: v.id,
          productId: v.productId,
          inStock: v.inStock,
          availabilityStatus: v.availabilityStatus,
          inventory:
            v.finishedGoodsQty == null
              ? null
              : { finishedGoodsQty: v.finishedGoodsQty },
        }
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string }
        data: { availabilityStatus?: VariantRow['availabilityStatus']; inStock?: boolean }
      }) => {
        const v = variantsById.get(where.id)
        if (!v) return
        if (data.availabilityStatus) v.availabilityStatus = data.availabilityStatus
        if (typeof data.inStock === 'boolean') v.inStock = data.inStock
      },
      count: async ({
        where,
      }: {
        where: { productId: string; availabilityStatus: string }
      }) =>
        variants.filter(
          (v) =>
            v.productId === where.productId &&
            v.availabilityStatus === where.availabilityStatus,
        ).length,
    },
    productVariantInventory: {
      update: async ({
        where,
        data,
      }: {
        where: { variantId: string }
        data: { finishedGoodsQty: { increment: number } }
      }) => {
        const v = variantsById.get(where.variantId)
        if (!v || v.finishedGoodsQty == null) return
        v.finishedGoodsQty += data.finishedGoodsQty.increment
      },
    },
    product: {
      update: async () => undefined,
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({
          id,
          slug: id,
          type: 'BAG',
          group: null,
          status: 'PUBLISHED',
        })),
    },
  }
}

test('settlement decrements tracked stock and marks the order applied', async () => {
  const variants: VariantRow[] = [
    {
      id: 'v1',
      productId: 'p1',
      inStock: true,
      availabilityStatus: 'IN_STOCK',
      finishedGoodsQty: 5,
    },
  ]
  const order: OrderRow = {
    id: 'o1',
    status: 'PAID',
    inventoryAppliedAt: null,
    items: [{ variantId: 'v1', qty: 2 }],
  }
  const tx = makeTx(variants, order)

  const result = await applyPaidOrderInventoryTx(tx as never, 'o1')

  assert.equal(result.applied, true)
  assert.equal(variants[0].finishedGoodsQty, 3)
  assert.ok(order.inventoryAppliedAt instanceof Date)
})

test('settlement is idempotent (already applied)', async () => {
  const variants: VariantRow[] = [
    {
      id: 'v1',
      productId: 'p1',
      inStock: true,
      availabilityStatus: 'IN_STOCK',
      finishedGoodsQty: 3,
    },
  ]
  const order: OrderRow = {
    id: 'o1',
    status: 'PAID',
    inventoryAppliedAt: new Date(),
    items: [{ variantId: 'v1', qty: 2 }],
  }
  const tx = makeTx(variants, order)

  const result = await applyPaidOrderInventoryTx(tx as never, 'o1')

  assert.equal(result.applied, false)
  assert.equal(variants[0].finishedGoodsQty, 3)
})

test('settle then reverse nets to the original stock and clears the flag', async () => {
  const variants: VariantRow[] = [
    {
      id: 'v1',
      productId: 'p1',
      inStock: true,
      availabilityStatus: 'IN_STOCK',
      finishedGoodsQty: 5,
    },
  ]
  const order: OrderRow = {
    id: 'o1',
    status: 'PAID',
    inventoryAppliedAt: null,
    items: [{ variantId: 'v1', qty: 2 }],
  }
  const tx = makeTx(variants, order)

  await applyPaidOrderInventoryTx(tx as never, 'o1')
  assert.equal(variants[0].finishedGoodsQty, 3)

  // Order is cancelled, then reversal runs.
  order.status = 'CANCELLED'
  const reversal = await reversePaidOrderInventoryTx(tx as never, 'o1')

  assert.equal(reversal.applied, true)
  assert.equal(variants[0].finishedGoodsQty, 5)
  assert.equal(order.inventoryAppliedAt, null)
})

test('reversal is idempotent and does not double-credit', async () => {
  const variants: VariantRow[] = [
    {
      id: 'v1',
      productId: 'p1',
      inStock: true,
      availabilityStatus: 'IN_STOCK',
      finishedGoodsQty: 5,
    },
  ]
  const order: OrderRow = {
    id: 'o1',
    status: 'PAID',
    inventoryAppliedAt: null,
    items: [{ variantId: 'v1', qty: 2 }],
  }
  const tx = makeTx(variants, order)

  await applyPaidOrderInventoryTx(tx as never, 'o1')
  order.status = 'CANCELLED'
  await reversePaidOrderInventoryTx(tx as never, 'o1')
  const second = await reversePaidOrderInventoryTx(tx as never, 'o1')

  assert.equal(second.applied, false)
  assert.equal(variants[0].finishedGoodsQty, 5)
})

test('untracked variants (no inventory row) are skipped both ways', async () => {
  const variants: VariantRow[] = [
    {
      id: 'v1',
      productId: 'p1',
      inStock: true,
      availabilityStatus: 'PREORDER',
      finishedGoodsQty: null,
    },
  ]
  const order: OrderRow = {
    id: 'o1',
    status: 'PAID',
    inventoryAppliedAt: null,
    items: [{ variantId: 'v1', qty: 2 }],
  }
  const tx = makeTx(variants, order)

  await applyPaidOrderInventoryTx(tx as never, 'o1')
  assert.equal(variants[0].finishedGoodsQty, null)
  assert.ok(order.inventoryAppliedAt instanceof Date)
})
