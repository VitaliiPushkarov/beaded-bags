import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'

export const ADMIN_PRODUCT_SAVE_TRANSACTION = {
  // Large product cards can touch variants, galleries, pouches, pouch straps,
  // and sizes in one save. Prisma's default interactive transaction budget is
  // too small for that on a cold/serverless database connection; once it closes
  // the next `tx.*` call surfaces as "Transaction not found".
  maxWait: 15000,
  timeout: 60000,
} as const

export type VariantStrapOptionInput = {
  id?: string
  name: string
  liqpayGoodId?: number | null
  extraPriceUAH?: number
  sort?: number
  imageUrl?: string | null
}

export type VariantPouchStrapOptionInput = {
  id?: string
  name: string
  hex?: string | null
  sort?: number
  mainImageUrl?: string | null
}

export type VariantPouchOptionInput = {
  id?: string
  color: string
  hex?: string | null
  liqpayGoodId?: number | null
  extraPriceUAH?: number
  sort?: number
  imageUrl?: string | null
  straps?: VariantPouchStrapOptionInput[]
}

export type VariantSizeOptionInput = {
  id?: string
  size: string
  liqpayGoodId?: number | null
  extraPriceUAH?: number
  sort?: number
  imageUrl?: string | null
}

export type ExistingVariantOptions = {
  strapIds: Set<string>
  pouchIds: Set<string>
  pouchStrapIdsByPouchId: Map<string, Set<string>>
  sizeIds: Set<string>
}

export function stableExistingId(
  inputId: string | undefined,
  ownedIds: ReadonlySet<string> | undefined,
) {
  return inputId && ownedIds?.has(inputId) ? inputId : randomUUID()
}

export async function reconcileVariantStraps(
  tx: Prisma.TransactionClient,
  variantId: string,
  straps: VariantStrapOptionInput[],
  existingIds: ReadonlySet<string> | undefined,
) {
  const rows = straps.map((strap, index) => ({
    id: stableExistingId(strap.id, existingIds),
    strap,
    sort: strap.sort ?? index,
  }))
  const keepIds = rows.map((row) => row.id)

  if (!rows.length && !existingIds?.size) return

  await tx.productVariantStrap.deleteMany({
    where: {
      variantId,
      ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
    },
  })

  if (!rows.length) return

  await tx.$executeRaw`
    INSERT INTO "ProductVariantStrap"
      ("id", "variantId", "name", "liqpayGoodId", "extraPriceUAH", "sort", "imageUrl")
    VALUES ${Prisma.join(
      rows.map(
        ({ id, strap, sort }) => Prisma.sql`(
          ${id},
          ${variantId},
          ${strap.name},
          ${strap.liqpayGoodId ?? null},
          ${strap.extraPriceUAH ?? 0},
          ${sort},
          ${strap.imageUrl ?? null}
        )`,
      ),
    )}
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED."name",
      "liqpayGoodId" = EXCLUDED."liqpayGoodId",
      "extraPriceUAH" = EXCLUDED."extraPriceUAH",
      "sort" = EXCLUDED."sort",
      "imageUrl" = EXCLUDED."imageUrl"
    WHERE "ProductVariantStrap"."variantId" = EXCLUDED."variantId"
  `
}

export async function reconcileVariantPouches(
  tx: Prisma.TransactionClient,
  variantId: string,
  pouches: VariantPouchOptionInput[],
  existing: ExistingVariantOptions | undefined,
  pouchStrapCustomization: boolean,
) {
  const pouchRows = pouches.map((pouch, index) => ({
    id: stableExistingId(pouch.id, existing?.pouchIds),
    pouch,
    sort: pouch.sort ?? index,
  }))
  const keepPouchIds = pouchRows.map((row) => row.id)

  if (!pouchRows.length && !existing?.pouchIds.size) return

  await tx.productVariantPouch.deleteMany({
    where: {
      variantId,
      ...(keepPouchIds.length ? { id: { notIn: keepPouchIds } } : {}),
    },
  })

  if (pouchRows.length) {
    await tx.$executeRaw`
      INSERT INTO "ProductVariantPouch"
        ("id", "variantId", "color", "hex", "liqpayGoodId", "extraPriceUAH", "sort", "imageUrl")
      VALUES ${Prisma.join(
        pouchRows.map(
          ({ id, pouch, sort }) => Prisma.sql`(
            ${id},
            ${variantId},
            ${pouch.color},
            ${pouch.hex || null},
            ${pouch.liqpayGoodId ?? null},
            ${pouch.extraPriceUAH ?? 0},
            ${sort},
            ${pouch.imageUrl ?? null}
          )`,
        ),
      )}
      ON CONFLICT ("id") DO UPDATE SET
        "color" = EXCLUDED."color",
        "hex" = EXCLUDED."hex",
        "liqpayGoodId" = EXCLUDED."liqpayGoodId",
        "extraPriceUAH" = EXCLUDED."extraPriceUAH",
        "sort" = EXCLUDED."sort",
        "imageUrl" = EXCLUDED."imageUrl"
      WHERE "ProductVariantPouch"."variantId" = EXCLUDED."variantId"
    `
  }

  // With the configurator off the form hides the strap editor and sends no
  // straps at all. Preserve the existing pouch straps in that mode.
  if (!pouchStrapCustomization || !keepPouchIds.length) return

  const pouchStrapRows = pouchRows.flatMap(({ id: pouchId, pouch }) =>
    (pouch.straps ?? []).map((strap, index) => ({
      id: stableExistingId(
        strap.id,
        existing?.pouchStrapIdsByPouchId.get(pouchId),
      ),
      pouchId,
      strap,
      sort: strap.sort ?? index,
    })),
  )
  const keepPouchStrapIds = pouchStrapRows.map((row) => row.id)
  const hasExistingPouchStraps = keepPouchIds.some(
    (pouchId) => (existing?.pouchStrapIdsByPouchId.get(pouchId)?.size ?? 0) > 0,
  )

  if (!pouchStrapRows.length && !hasExistingPouchStraps) return

  await tx.productVariantPouchStrap.deleteMany({
    where: {
      pouchId: { in: keepPouchIds },
      ...(keepPouchStrapIds.length
        ? { id: { notIn: keepPouchStrapIds } }
        : {}),
    },
  })

  if (!pouchStrapRows.length) return

  await tx.$executeRaw`
    INSERT INTO "ProductVariantPouchStrap"
      ("id", "pouchId", "name", "hex", "sort", "mainImageUrl", "createdAt", "updatedAt")
    VALUES ${Prisma.join(
      pouchStrapRows.map(
        ({ id, pouchId, strap, sort }) => Prisma.sql`(
          ${id},
          ${pouchId},
          ${strap.name},
          ${strap.hex ?? null},
          ${sort},
          ${strap.mainImageUrl ?? null},
          NOW(),
          NOW()
        )`,
      ),
    )}
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED."name",
      "hex" = EXCLUDED."hex",
      "sort" = EXCLUDED."sort",
      "mainImageUrl" = EXCLUDED."mainImageUrl",
      "updatedAt" = NOW()
    WHERE "ProductVariantPouchStrap"."pouchId" = EXCLUDED."pouchId"
  `
}

export async function reconcileVariantSizes(
  tx: Prisma.TransactionClient,
  variantId: string,
  sizes: VariantSizeOptionInput[],
  existingIds: ReadonlySet<string> | undefined,
) {
  const rows = sizes.map((size, index) => ({
    id: stableExistingId(size.id, existingIds),
    size,
    sort: size.sort ?? index,
  }))
  const keepIds = rows.map((row) => row.id)

  if (!rows.length && !existingIds?.size) return

  await tx.productVariantSize.deleteMany({
    where: {
      variantId,
      ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
    },
  })

  if (!rows.length) return

  await tx.$executeRaw`
    INSERT INTO "ProductVariantSize"
      ("id", "variantId", "size", "liqpayGoodId", "extraPriceUAH", "sort", "imageUrl")
    VALUES ${Prisma.join(
      rows.map(
        ({ id, size, sort }) => Prisma.sql`(
          ${id},
          ${variantId},
          ${size.size},
          ${size.liqpayGoodId ?? null},
          ${size.extraPriceUAH ?? 0},
          ${sort},
          ${size.imageUrl ?? null}
        )`,
      ),
    )}
    ON CONFLICT ("id") DO UPDATE SET
      "size" = EXCLUDED."size",
      "liqpayGoodId" = EXCLUDED."liqpayGoodId",
      "extraPriceUAH" = EXCLUDED."extraPriceUAH",
      "sort" = EXCLUDED."sort",
      "imageUrl" = EXCLUDED."imageUrl"
    WHERE "ProductVariantSize"."variantId" = EXCLUDED."variantId"
  `
}
