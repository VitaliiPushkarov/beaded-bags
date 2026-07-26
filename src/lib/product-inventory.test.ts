import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  applyPaidOrderInventoryTx,
  applyProductionInventoryTx,
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

type MaterialRow = { id: string; stockQty: number }
type ProductMaterialRow = {
  productId: string
  materialId: string
  quantity: number
  variantColor: string
}

function makeTx(
  variants: VariantRow[],
  order: OrderRow,
  opts: { materials?: MaterialRow[]; productMaterials?: ProductMaterialRow[] } = {},
) {
  const variantsById = new Map(variants.map((v) => [v.id, v]))
  const materialsById = new Map((opts.materials ?? []).map((m) => [m.id, m]))
  const productMaterials = opts.productMaterials ?? []

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
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { variantId: string }
        create: { finishedGoodsQty: number }
        update: { finishedGoodsQty: { increment: number } }
      }) => {
        const v = variantsById.get(where.variantId)
        if (!v) return
        if (v.finishedGoodsQty == null) {
          v.finishedGoodsQty = create.finishedGoodsQty
        } else {
          v.finishedGoodsQty += update.finishedGoodsQty.increment
        }
      },
    },
    productMaterial: {
      findMany: async ({ where }: { where: { productId: string } }) =>
        productMaterials
          .filter((pm) => pm.productId === where.productId)
          .map((pm) => ({
            materialId: pm.materialId,
            quantity: pm.quantity,
            variantColor: pm.variantColor,
          })),
    },
    material: {
      update: async ({
        where,
        data,
      }: {
        where: { id: string }
        data: { stockQty: { decrement: number } }
      }) => {
        const m = materialsById.get(where.id)
        if (!m) return
        m.stockQty -= data.stockQty.decrement
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

test('production adds finished goods and consumes matching materials', async () => {
  const variants: VariantRow[] = [
    {
      id: 'v1',
      productId: 'p1',
      inStock: false,
      availabilityStatus: 'PREORDER',
      finishedGoodsQty: 1,
    },
  ]
  const materials: MaterialRow[] = [
    { id: 'm-beads', stockQty: 100 },
    { id: 'm-clasp', stockQty: 50 },
    { id: 'm-redonly', stockQty: 30 },
  ]
  const productMaterials: ProductMaterialRow[] = [
    { productId: 'p1', materialId: 'm-beads', quantity: 3, variantColor: '' }, // all variants
    { productId: 'p1', materialId: 'm-clasp', quantity: 1, variantColor: 'Blue' }, // this variant
    { productId: 'p1', materialId: 'm-redonly', quantity: 5, variantColor: 'Red' }, // other variant
  ]
  const tx = makeTx(variants, { id: 'o0', status: 'PAID', inventoryAppliedAt: null, items: [] }, {
    materials,
    productMaterials,
  })

  const result = await applyProductionInventoryTx(tx as never, {
    productId: 'p1',
    variantId: 'v1',
    variantColor: 'Blue',
    qty: 4,
  })

  // 4 units produced on top of the existing 1
  assert.equal(variants[0].finishedGoodsQty, 5)
  // beads (all): 100 - 3*4 = 88 ; clasp (Blue): 50 - 1*4 = 46 ; red-only: untouched
  assert.equal(materials[0].stockQty, 88)
  assert.equal(materials[1].stockQty, 46)
  assert.equal(materials[2].stockQty, 30)
  assert.equal(result.materialsConsumed.length, 2)
})

test('production starts tracking an untracked variant', async () => {
  const variants: VariantRow[] = [
    {
      id: 'v1',
      productId: 'p1',
      inStock: false,
      availabilityStatus: 'PREORDER',
      finishedGoodsQty: null,
    },
  ]
  const tx = makeTx(variants, { id: 'o0', status: 'PAID', inventoryAppliedAt: null, items: [] })

  await applyProductionInventoryTx(tx as never, {
    productId: 'p1',
    variantId: 'v1',
    variantColor: null,
    qty: 3,
  })

  assert.equal(variants[0].finishedGoodsQty, 3)
})
