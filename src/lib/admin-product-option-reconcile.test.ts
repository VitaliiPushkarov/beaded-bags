import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Prisma } from '@prisma/client'

import {
  ADMIN_PRODUCT_SAVE_TRANSACTION,
  reconcileVariantPouches,
  reconcileVariantSizes,
  reconcileVariantStraps,
  stableExistingId,
  type ExistingVariantOptions,
  type VariantPouchOptionInput,
  type VariantSizeOptionInput,
  type VariantStrapOptionInput,
} from './admin-product-option-reconcile'

const ADMIN_PRODUCT_ROUTE = join(
  process.cwd(),
  'src/app/api/admin/products/[id]/route.ts',
)
const OPTION_RECONCILE_MODULE = join(
  process.cwd(),
  'src/lib/admin-product-option-reconcile.ts',
)

type DeleteCall = {
  model: string
  where: unknown
}

type MockCalls = {
  deletes: DeleteCall[]
  rawQueries: unknown[][]
}

function createMockTx() {
  const calls: MockCalls = { deletes: [], rawQueries: [] }

  const deleteMany =
    (model: string) =>
    async ({ where }: { where: unknown }) => {
      calls.deletes.push({ model, where })
      return { count: 1 }
    }

  const failPerRowMutation = async () => {
    throw new Error('row-by-row mutation should not be used for option reconcile')
  }

  const tx = {
    productVariantStrap: {
      deleteMany: deleteMany('productVariantStrap'),
      updateMany: failPerRowMutation,
      create: failPerRowMutation,
    },
    productVariantPouch: {
      deleteMany: deleteMany('productVariantPouch'),
      updateMany: failPerRowMutation,
      create: failPerRowMutation,
    },
    productVariantPouchStrap: {
      deleteMany: deleteMany('productVariantPouchStrap'),
      updateMany: failPerRowMutation,
      create: failPerRowMutation,
    },
    productVariantSize: {
      deleteMany: deleteMany('productVariantSize'),
      updateMany: failPerRowMutation,
      create: failPerRowMutation,
    },
    $executeRaw: async (...args: unknown[]) => {
      calls.rawQueries.push(args)
      return 1
    },
  } as unknown as Prisma.TransactionClient

  return { tx, calls }
}

function existingOptions(): ExistingVariantOptions {
  return {
    strapIds: new Set(['strap-0', 'strap-1']),
    pouchIds: new Set(['pouch-0', 'pouch-1']),
    pouchStrapIdsByPouchId: new Map([
      ['pouch-0', new Set(['pouch-0-strap-0', 'pouch-0-strap-1'])],
      ['pouch-1', new Set(['pouch-1-strap-0', 'pouch-1-strap-1'])],
    ]),
    sizeIds: new Set(['size-0', 'size-1']),
  }
}

function buildStraps(count: number): VariantStrapOptionInput[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index < 2 ? `strap-${index}` : undefined,
    name: `Strap ${index}`,
    liqpayGoodId: index < 2 ? 1000 + index : null,
    extraPriceUAH: index,
    sort: index,
    imageUrl: `/strap-${index}.jpg`,
  }))
}

function buildPouches(
  pouchCount: number,
  strapsPerPouch: number,
): VariantPouchOptionInput[] {
  return Array.from({ length: pouchCount }, (_, pouchIndex) => ({
    id: pouchIndex < 2 ? `pouch-${pouchIndex}` : undefined,
    color: `Pouch ${pouchIndex}`,
    hex: pouchIndex % 2 === 0 ? '#ffffff' : null,
    liqpayGoodId: null,
    extraPriceUAH: 0,
    sort: pouchIndex,
    imageUrl: `/pouch-${pouchIndex}.jpg`,
    straps: Array.from({ length: strapsPerPouch }, (_, strapIndex) => ({
      id:
        pouchIndex < 2 && strapIndex < 2
          ? `pouch-${pouchIndex}-strap-${strapIndex}`
          : undefined,
      name: `Pouch ${pouchIndex} Strap ${strapIndex}`,
      hex: null,
      sort: strapIndex,
      mainImageUrl: `/pouch-${pouchIndex}-strap-${strapIndex}.jpg`,
    })),
  }))
}

function buildSizes(count: number): VariantSizeOptionInput[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index < 2 ? `size-${index}` : undefined,
    size: `Size ${index}`,
    liqpayGoodId: null,
    extraPriceUAH: index,
    sort: index,
    imageUrl: `/size-${index}.jpg`,
  }))
}

test('admin product option save does not use row-by-row mutations from the reported failures', () => {
  const routeSource = readFileSync(ADMIN_PRODUCT_ROUTE, 'utf8')
  const reconcileSource = readFileSync(OPTION_RECONCILE_MODULE, 'utf8')
  const source = `${routeSource}\n${reconcileSource}`

  assert.equal(source.includes('productVariantPouchStrap.updateMany'), false)
  assert.equal(source.includes('productVariantSize.updateMany'), false)
  assert.match(routeSource, /reconcileVariantPouches/)
  assert.match(routeSource, /reconcileVariantSizes/)
})

test('bulk option reconcile keeps Prisma calls fixed for a large variant payload', async () => {
  const { tx, calls } = createMockTx()
  const existing = existingOptions()

  await reconcileVariantStraps(tx, 'variant-1', buildStraps(50), existing.strapIds)
  await reconcileVariantPouches(
    tx,
    'variant-1',
    buildPouches(20, 6),
    existing,
    true,
  )
  await reconcileVariantSizes(tx, 'variant-1', buildSizes(50), existing.sizeIds)

  assert.deepEqual(
    calls.deletes.map((call) => call.model),
    [
      'productVariantStrap',
      'productVariantPouch',
      'productVariantPouchStrap',
      'productVariantSize',
    ],
  )
  assert.equal(calls.rawQueries.length, 4)
})

test('hidden pouch strap editor preserves existing pouch straps', async () => {
  const { tx, calls } = createMockTx()
  const existing = existingOptions()

  await reconcileVariantPouches(
    tx,
    'variant-1',
    [
      {
        id: 'pouch-0',
        color: 'Pouch 0',
        sort: 0,
        imageUrl: '/pouch-0.jpg',
        straps: [],
      },
    ],
    existing,
    false,
  )

  assert.deepEqual(
    calls.deletes.map((call) => call.model),
    ['productVariantPouch'],
  )
  assert.equal(calls.rawQueries.length, 1)
})

test('empty incoming and empty existing options are a no-op', async () => {
  const { tx, calls } = createMockTx()
  const emptyExisting: ExistingVariantOptions = {
    strapIds: new Set(),
    pouchIds: new Set(),
    pouchStrapIdsByPouchId: new Map(),
    sizeIds: new Set(),
  }

  await reconcileVariantStraps(tx, 'variant-1', [], emptyExisting.strapIds)
  await reconcileVariantPouches(tx, 'variant-1', [], emptyExisting, true)
  await reconcileVariantSizes(tx, 'variant-1', [], emptyExisting.sizeIds)

  assert.equal(calls.deletes.length, 0)
  assert.equal(calls.rawQueries.length, 0)
})

test('stale option ids are replaced instead of being upserted across variants', () => {
  assert.equal(stableExistingId('owned-id', new Set(['owned-id'])), 'owned-id')

  const generated = stableExistingId('foreign-id', new Set(['owned-id']))
  assert.notEqual(generated, 'foreign-id')
  assert.match(
    generated,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  )
})

test('admin product save transaction keeps enough budget for serverless database latency', () => {
  assert.equal(ADMIN_PRODUCT_SAVE_TRANSACTION.maxWait >= 15_000, true)
  assert.equal(ADMIN_PRODUCT_SAVE_TRANSACTION.timeout >= 60_000, true)
})
