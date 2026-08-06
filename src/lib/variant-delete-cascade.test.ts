import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Prisma } from '@prisma/client'

// Regression guard for the admin product save.
//
// Deleting a ProductVariant fails with a foreign key violation if any child row
// still points at it and the relation is not declared `onDelete: Cascade`.
// That is what broke when a variant was removed while editing a product:
// ProductVariantImage was neither cascaded nor deleted by hand, so
// `productVariant.deleteMany()` tripped ProductVariantImage_variantId_fkey.
//
// The delete list in the route has to stay in sync with the schema, and nothing
// enforced that. These tests derive the blocking relations from the Prisma
// schema itself, so adding a new child table without either cascading it or
// deleting it in the route fails here instead of in production.

const ADMIN_PRODUCT_ROUTE = join(
  process.cwd(),
  'src/app/api/admin/products/[id]/route.ts',
)

// A relation blocks the parent delete unless the database cleans it up for us.
// Cascade removes the row; SetNull nulls an optional FK. Anything else (which
// in practice means the Prisma default, Restrict) has to be handled in code.
const NON_BLOCKING_ACTIONS = new Set(['Cascade', 'SetNull'])

type BlockingRelation = { model: string; field: string }

function findBlockingRelations(parentModel: string): BlockingRelation[] {
  const blocking: BlockingRelation[] = []

  for (const model of Prisma.dmmf.datamodel.models) {
    for (const field of model.fields) {
      const isOwningRelationToParent =
        field.kind === 'object' &&
        field.type === parentModel &&
        (field.relationFromFields?.length ?? 0) > 0

      if (!isOwningRelationToParent) continue

      const onDelete = (field as { relationOnDelete?: string }).relationOnDelete
      if (onDelete && NON_BLOCKING_ACTIONS.has(onDelete)) continue

      blocking.push({ model: model.name, field: field.name })
    }
  }

  return blocking
}

function toPrismaClientProperty(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1)
}

test('every blocking child of ProductVariant is deleted by the admin save route', () => {
  const source = readFileSync(ADMIN_PRODUCT_ROUTE, 'utf8')
  const blocking = findBlockingRelations('ProductVariant')

  // Sanity: if this is empty the query is wrong, not the schema.
  assert.ok(
    blocking.length > 0,
    'expected ProductVariant to have at least one non-cascading child relation',
  )

  const missing = blocking.filter(({ model }) => {
    const property = toPrismaClientProperty(model)
    return !source.includes(`tx.${property}.deleteMany`)
  })

  assert.deepEqual(
    missing,
    [],
    `These models point at ProductVariant without onDelete: Cascade, so the ` +
      `variant delete in ${ADMIN_PRODUCT_ROUTE} will fail with a foreign key ` +
      `violation. Either add onDelete: Cascade in schema.prisma, or delete ` +
      `them explicitly before productVariant.deleteMany(): ` +
      missing.map((relation) => relation.model).join(', '),
  )
})

test('ProductVariantImage specifically is cleaned up before the variant', () => {
  // The exact relation from the reported failure.
  const source = readFileSync(ADMIN_PRODUCT_ROUTE, 'utf8')

  const imageDeleteIndex = source.indexOf('tx.productVariantImage.deleteMany')
  const variantDeleteIndex = source.indexOf('tx.productVariant.deleteMany')

  assert.notEqual(
    imageDeleteIndex,
    -1,
    'variant images must be deleted before the variant',
  )
  assert.notEqual(variantDeleteIndex, -1, 'expected the variant deleteMany call')
  assert.ok(
    imageDeleteIndex < variantDeleteIndex,
    'variant images must be deleted BEFORE productVariant.deleteMany()',
  )
})

test('the relations we believe cascade really do cascade', () => {
  // If one of these ever loses its cascade, the route would need a new
  // deleteMany — the first test would catch it, this one names the culprit.
  const blocking = new Set(
    findBlockingRelations('ProductVariant').map((relation) => relation.model),
  )

  for (const model of [
    'ProductVariantInventory',
    'ProductVariantPouch',
    'ProductVariantSize',
  ]) {
    assert.equal(
      blocking.has(model),
      false,
      `${model} is expected to cascade on variant delete`,
    )
  }
})
