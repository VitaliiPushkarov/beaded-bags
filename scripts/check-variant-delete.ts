// Verifies that a ProductVariant with a full set of children can actually be
// deleted, using the same order as the admin save route
// (src/app/api/admin/products/[id]/route.ts).
//
// Everything happens inside a transaction that is always rolled back, on
// throwaway rows only, so this is safe to run against the production database.
//
//   npm run check:variant-delete

import { prisma } from '@/lib/prisma'

const ROLLBACK = 'ROLLBACK_SENTINEL'
const PROBE_SLUG_PREFIX = 'zz-variant-delete-check-'

type Result = { ok: boolean; detail: string }

async function run(): Promise<Result> {
  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          slug: `${PROBE_SLUG_PREFIX}${Date.now()}`,
          name: 'Variant delete check (rolled back)',
          type: 'BAG',
        },
        select: { id: true },
      })

      // The variant we will delete, with one of every child the schema allows.
      const doomed = await tx.productVariant.create({
        data: {
          productId: product.id,
          color: 'probe',
          images: {
            create: [{ url: '/img/probe-1.jpg' }, { url: '/img/probe-2.jpg' }],
          },
          straps: {
            create: [
              {
                name: 'Probe strap',
                images: { create: [{ url: '/img/probe-strap.jpg' }] },
              },
            ],
          },
          pouches: { create: [{ color: 'probe pouch' }] },
          sizes: { create: [{ size: 'M' }] },
          inventory: { create: { finishedGoodsQty: 3 } },
        },
        select: { id: true },
      })

      // A surviving variant, linked to the doomed one as an addon in both
      // directions — the join table is Restrict on both sides.
      const survivor = await tx.productVariant.create({
        data: { productId: product.id, color: 'survivor' },
        select: { id: true },
      })
      await tx.productVariantAddon.createMany({
        data: [
          { variantId: survivor.id, addonVariantId: doomed.id },
          { variantId: doomed.id, addonVariantId: survivor.id },
        ],
      })

      // --- the exact sequence used by the admin save route ---
      const toDeleteIds = [doomed.id]

      await tx.productVariantAddon.deleteMany({
        where: {
          OR: [
            { variantId: { in: toDeleteIds } },
            { addonVariantId: { in: toDeleteIds } },
          ],
        },
      })
      await tx.productVariantImage.deleteMany({
        where: { variantId: { in: toDeleteIds } },
      })
      await tx.productVariantStrap.deleteMany({
        where: { variantId: { in: toDeleteIds } },
      })
      await tx.productVariantPouch.deleteMany({
        where: { variantId: { in: toDeleteIds } },
      })
      await tx.productVariantSize.deleteMany({
        where: { variantId: { in: toDeleteIds } },
      })

      await tx.productVariant.deleteMany({ where: { id: { in: toDeleteIds } } })
      // --- end of the route's sequence ---

      const stillThere = await tx.productVariant.count({
        where: { id: doomed.id },
      })
      if (stillThere !== 0) {
        throw new Error(`variant survived the delete (count=${stillThere})`)
      }

      const survivorIntact = await tx.productVariant.count({
        where: { id: survivor.id },
      })
      if (survivorIntact !== 1) {
        throw new Error('the surviving variant was removed too')
      }

      throw new Error(ROLLBACK)
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === ROLLBACK) {
      return { ok: true, detail: 'variant with images/straps/pouches/sizes/addons deleted cleanly' }
    }

    const constraintLine = message
      .split('\n')
      .find((line) => line.includes('constraint'))
    return { ok: false, detail: constraintLine?.trim() ?? message.slice(0, 200) }
  }

  return { ok: false, detail: 'transaction committed unexpectedly' }
}

async function main() {
  const result = await run()

  // Nothing should ever be left behind; report it loudly if it is.
  const leftover = await prisma.product.count({
    where: { slug: { startsWith: PROBE_SLUG_PREFIX } },
  })

  console.log(result.ok ? 'PASS' : 'FAIL', '—', result.detail)
  console.log('leftover probe products:', leftover)

  await prisma.$disconnect()

  if (!result.ok || leftover !== 0) process.exitCode = 1
}

main()
