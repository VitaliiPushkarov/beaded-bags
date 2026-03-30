import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import {
  ProductType,
  ProductGroup,
  ProductStatus,
  AvailabilityStatus,
} from '@prisma/client'
import { isInStockStatus, resolveAvailabilityStatus } from '@/lib/availability'
import { revalidateProductCache } from '@/lib/revalidate-products'

const ImagePath = z
  .string()
  .trim()
  .min(1)
  .refine(
    (s) =>
      s.startsWith('/') || s.startsWith('http://') || s.startsWith('https://'),
    'Invalid image path',
  )

const StrapSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  extraPriceUAH: z.coerce.number().int().min(0).optional().default(0),
  sort: z.coerce.number().int().optional().default(0),
  imageUrl: ImagePath.optional().nullable(),
})

const PouchSchema = z.object({
  id: z.string().optional(),
  color: z.string().trim().min(1),
  extraPriceUAH: z.coerce.number().int().min(0).optional().default(0),
  sort: z.coerce.number().int().optional().default(0),
  imageUrl: ImagePath.optional().nullable(),
})

const SizeSchema = z.object({
  id: z.string().optional(),
  size: z.string().trim().min(1),
  extraPriceUAH: z.coerce.number().int().min(0).optional().default(0),
  sort: z.coerce.number().int().optional().default(0),
  imageUrl: ImagePath.optional().nullable(),
})

const NullablePriceSchema = z.preprocess(
  (value) => {
    if (value === '' || value == null) return null
    const num = Number(value)
    return Number.isFinite(num) ? num : value
  },
  z.number().int().min(0).nullable(),
)

// --------- Zod-схеми ---------
const VariantSchema = z.object({
  id: z.string().optional(),
  color: z.string().optional().nullable(),
  modelSize: z.string().optional().nullable(),
  pouchColor: z.string().optional().nullable(),
  hex: z.string().optional().nullable(),
  image: ImagePath.optional().nullable(),
  images: z.array(ImagePath).optional().default([]),
  priceUAH: NullablePriceSchema,
  discountPercent: z.coerce.number().optional().nullable(),
  discountUAH: z.coerce.number().optional().nullable(),
  availabilityStatus: z.enum(AvailabilityStatus).optional().nullable(),
  inStock: z.coerce.boolean(),
  sku: z.string().trim().optional().nullable(),
  shippingNote: z.string().trim().optional().nullable(),
  straps: z.array(StrapSchema).optional().default([]),
  pouches: z.array(PouchSchema).optional().default([]),
  sizes: z.array(SizeSchema).optional().default([]),
})

const ProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  type: z.enum(ProductType),
  status: z.nativeEnum(ProductStatus).optional(),
  group: z.enum(ProductGroup).optional().nullable(),
  sortCatalog: z.coerce.number().int().optional().nullable(),
  basePriceUAH: NullablePriceSchema,
  description: z.string().optional().nullable(),
  info: z.string().optional().nullable(),
  dimensions: z.string().optional().nullable(),
  offerNote: z.string().optional().nullable(),
  inStock: z.coerce.boolean(),
  variants: z.array(VariantSchema).min(1),
})

function sanitizeDiscountPercent(input: number | null | undefined) {
  if (typeof input !== 'number' || !Number.isFinite(input)) return null
  return Math.max(0, Math.min(100, Math.round(input)))
}

function sanitizeSortCatalog(input: number | null | undefined) {
  if (typeof input !== 'number' || !Number.isFinite(input)) return 0
  return Math.max(0, Math.round(input))
}

// --------- PATCH: оновлення товару ---------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const existing = await prisma.product.findUnique({
      where: { id },
      select: {
        slug: true,
        type: true,
        group: true,
        status: true,
        dimensions: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const json = await req.json()
    const parsed = ProductSchema.safeParse(json)

    if (!parsed.success) {
      const flat = parsed.error.flatten()
      return NextResponse.json({ error: flat }, { status: 400 })
    }

    const data = parsed.data
    const normalizedType =
      data.type === 'ORNAMENTS' ? 'ACCESSORY' : data.type

    // Normalize group: allow null/undefined
    const nextGroup = (data.group ?? null) as ProductGroup | null
    const nextDimensions =
      typeof data.dimensions === 'undefined'
        ? (existing.dimensions ?? null)
        : data.dimensions?.trim()
          ? data.dimensions
          : null

    // Determine which variant IDs should remain
    const incomingIds = data.variants
      .map((v) => v.id)
      .filter((x): x is string => typeof x === 'string' && x.length > 0)

    const result = await prisma.$transaction(
      async (tx) => {
        // 1) update product fields (do NOT delete variants)
        const updated = await tx.product.update({
          where: { id },
          data: {
            name: data.name,
            slug: data.slug,
            type: normalizedType as ProductType,
            status: data.status ?? existing.status,
            group: nextGroup,
            sortCatalog: sanitizeSortCatalog(data.sortCatalog),
            basePriceUAH: data.basePriceUAH,
            description: data.description ?? null,
            info: data.info ?? null,
            dimensions: nextDimensions,
            offerNote: data.offerNote ?? null,
            inStock: data.inStock,
          },
          select: { id: true },
        })

        // 2) upsert variants
        const createdIds: string[] = []
        for (const v of data.variants) {
          const availabilityStatus = resolveAvailabilityStatus({
            availabilityStatus: v.availabilityStatus,
            inStock: v.inStock,
          })

          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                productId: id,
                color: v.color ?? null,
                modelSize: v.modelSize?.trim() || null,
                pouchColor: v.pouchColor?.trim() || null,
                hex: v.hex ?? null,
                image: v.image ?? null,
                images: {
                  deleteMany: {},
                  create: (v.images ?? []).map((url) => ({ url })),
                },
                priceUAH: v.priceUAH ?? null,
                discountPercent: sanitizeDiscountPercent(v.discountPercent),
                discountUAH: v.discountUAH ?? null,
                inStock: isInStockStatus(availabilityStatus),
                availabilityStatus,
                sku: v.sku ?? null,
                shippingNote: v.shippingNote ?? null,
              },
            })

            const keepStrapIds: string[] = []
            const straps = v.straps ?? []
            for (let i = 0; i < straps.length; i++) {
              const strap = straps[i]
              if (strap.id) {
                const updated = await tx.productVariantStrap.updateMany({
                  where: { id: strap.id, variantId: v.id },
                  data: {
                    name: strap.name,
                    extraPriceUAH: strap.extraPriceUAH ?? 0,
                    sort: strap.sort ?? i,
                    imageUrl: strap.imageUrl ?? null,
                  },
                })

                if (updated.count > 0) {
                  keepStrapIds.push(strap.id)
                } else {
                  const createdStrap = await tx.productVariantStrap.create({
                    data: {
                      variantId: v.id,
                      name: strap.name,
                      extraPriceUAH: strap.extraPriceUAH ?? 0,
                      sort: strap.sort ?? i,
                      imageUrl: strap.imageUrl ?? null,
                    },
                    select: { id: true },
                  })
                  keepStrapIds.push(createdStrap.id)
                }
              } else {
                const createdStrap = await tx.productVariantStrap.create({
                  data: {
                    variantId: v.id,
                    name: strap.name,
                    extraPriceUAH: strap.extraPriceUAH ?? 0,
                    sort: strap.sort ?? i,
                    imageUrl: strap.imageUrl ?? null,
                  },
                  select: { id: true },
                })
                keepStrapIds.push(createdStrap.id)
              }
            }

            await tx.productVariantStrap.deleteMany({
              where: {
                variantId: v.id,
                ...(keepStrapIds.length ? { id: { notIn: keepStrapIds } } : {}),
              },
            })

            const keepPouchIds: string[] = []
            const pouches = v.pouches ?? []
            for (let i = 0; i < pouches.length; i++) {
              const pouch = pouches[i]
              if (pouch.id) {
                const updated = await tx.productVariantPouch.updateMany({
                  where: { id: pouch.id, variantId: v.id },
                  data: {
                    color: pouch.color,
                    extraPriceUAH: pouch.extraPriceUAH ?? 0,
                    sort: pouch.sort ?? i,
                    imageUrl: pouch.imageUrl ?? null,
                  },
                })

                if (updated.count > 0) {
                  keepPouchIds.push(pouch.id)
                } else {
                  const createdPouch = await tx.productVariantPouch.create({
                    data: {
                      variantId: v.id,
                      color: pouch.color,
                      extraPriceUAH: pouch.extraPriceUAH ?? 0,
                      sort: pouch.sort ?? i,
                      imageUrl: pouch.imageUrl ?? null,
                    },
                    select: { id: true },
                  })
                  keepPouchIds.push(createdPouch.id)
                }
              } else {
                const createdPouch = await tx.productVariantPouch.create({
                  data: {
                    variantId: v.id,
                    color: pouch.color,
                    extraPriceUAH: pouch.extraPriceUAH ?? 0,
                    sort: pouch.sort ?? i,
                    imageUrl: pouch.imageUrl ?? null,
                  },
                  select: { id: true },
                })
                keepPouchIds.push(createdPouch.id)
              }
            }

            await tx.productVariantPouch.deleteMany({
              where: {
                variantId: v.id,
                ...(keepPouchIds.length ? { id: { notIn: keepPouchIds } } : {}),
              },
            })

            const keepSizeIds: string[] = []
            const sizes = v.sizes ?? []
            for (let i = 0; i < sizes.length; i++) {
              const size = sizes[i]
              if (size.id) {
                const updated = await tx.productVariantSize.updateMany({
                  where: { id: size.id, variantId: v.id },
                  data: {
                    size: size.size,
                    extraPriceUAH: size.extraPriceUAH ?? 0,
                    sort: size.sort ?? i,
                    imageUrl: size.imageUrl ?? null,
                  },
                })

                if (updated.count > 0) {
                  keepSizeIds.push(size.id)
                } else {
                  const createdSize = await tx.productVariantSize.create({
                    data: {
                      variantId: v.id,
                      size: size.size,
                      extraPriceUAH: size.extraPriceUAH ?? 0,
                      sort: size.sort ?? i,
                      imageUrl: size.imageUrl ?? null,
                    },
                    select: { id: true },
                  })
                  keepSizeIds.push(createdSize.id)
                }
              } else {
                const createdSize = await tx.productVariantSize.create({
                  data: {
                    variantId: v.id,
                    size: size.size,
                    extraPriceUAH: size.extraPriceUAH ?? 0,
                    sort: size.sort ?? i,
                    imageUrl: size.imageUrl ?? null,
                  },
                  select: { id: true },
                })
                keepSizeIds.push(createdSize.id)
              }
            }

            await tx.productVariantSize.deleteMany({
              where: {
                variantId: v.id,
                ...(keepSizeIds.length ? { id: { notIn: keepSizeIds } } : {}),
              },
            })
          } else {
            const created = await tx.productVariant.create({
              data: {
                productId: id,
                color: v.color ?? null,
                modelSize: v.modelSize?.trim() || null,
                pouchColor: v.pouchColor?.trim() || null,
                hex: v.hex ?? null,
                image: v.image ?? null,
                images: {
                  create: (v.images ?? []).map((url) => ({ url })),
                },
                priceUAH: v.priceUAH ?? null,
                discountPercent: sanitizeDiscountPercent(v.discountPercent),
                discountUAH: v.discountUAH ?? null,
                inStock: isInStockStatus(availabilityStatus),
                availabilityStatus,
                sku: v.sku ?? null,
                shippingNote: v.shippingNote ?? null,
                straps: {
                  create: (v.straps ?? []).map((s, i) => ({
                    name: s.name,
                    extraPriceUAH: s.extraPriceUAH ?? 0,
                    sort: s.sort ?? i,
                    imageUrl: s.imageUrl ?? null,
                  })),
                },
                pouches: {
                  create: (v.pouches ?? []).map((pouch, i) => ({
                    color: pouch.color,
                    extraPriceUAH: pouch.extraPriceUAH ?? 0,
                    sort: pouch.sort ?? i,
                    imageUrl: pouch.imageUrl ?? null,
                  })),
                },
                sizes: {
                  create: (v.sizes ?? []).map((size, i) => ({
                    size: size.size,
                    extraPriceUAH: size.extraPriceUAH ?? 0,
                    sort: size.sort ?? i,
                    imageUrl: size.imageUrl ?? null,
                  })),
                },
              },
              select: { id: true },
            })
            createdIds.push(created.id)
          }
        }

        // 3) delete variants removed from payload (and their addon links)
        const keepIds = [...incomingIds, ...createdIds]

        const toDelete = await tx.productVariant.findMany({
          where: {
            productId: id,
            ...(keepIds.length ? { id: { notIn: keepIds } } : {}),
          },
          select: { id: true },
        })

        const toDeleteIds = toDelete.map((x) => x.id)

        if (toDeleteIds.length) {
          // remove addon relations where these variants participate
          await tx.productVariantAddon.deleteMany({
            where: {
              OR: [
                { variantId: { in: toDeleteIds } },
                { addonVariantId: { in: toDeleteIds } },
              ],
            },
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

          await tx.productVariant.deleteMany({
            where: { id: { in: toDeleteIds } },
          })
        }

        return updated
      },
      {
        // Admin edits can touch many variants + images; allow more time than default 5s.
        timeout: 15000,
      },
    )

    revalidateProductCache({
      reason: 'update',
      before: existing,
      after: {
        slug: data.slug,
        type: normalizedType,
        group: nextGroup,
        status: data.status ?? existing.status,
      },
    })

    return NextResponse.json({ id: result.id }, { status: 200 })
  } catch (err) {
    console.error('Update product error:', err)
    // surface the message to help debugging in dev
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// --------- DELETE: видалення товару ---------
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { slug: true, type: true, group: true, status: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    await prisma.product.delete({ where: { id } })

    revalidateProductCache({
      reason: 'delete',
      before: existing,
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('Delete product error:', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}

// --------- GET: один товар ---------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          orderBy: { id: 'asc' },
          include: {
            images: true,
            straps: true,
            pouches: true,
            sizes: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (err) {
    console.error('GET product error', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}
