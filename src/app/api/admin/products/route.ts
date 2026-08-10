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
import { requireAdmin } from '@/lib/admin-auth'
import {
  ImagePath,
  OptionalImagePath,
  OptionalText,
} from '@/lib/admin-product-input'
import { revalidateProductCache } from '@/lib/revalidate-products'

const NullableIntSchema = z.preprocess(
  (value) => {
    if (value === '' || value == null) return null
    const num = Number(value)
    return Number.isFinite(num) ? num : value
  },
  z.number().int().positive().nullable(),
)

const StrapSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  liqpayGoodId: NullableIntSchema.optional(),
  extraPriceUAH: z.coerce.number().int().min(0).optional().default(0),
  sort: z.coerce.number().int().optional().default(0),
  imageUrl: OptionalImagePath,
})

// Straps offered for one pouch. No price and no fiscal id by design — same
// shape the edit endpoint accepts, so a product can be born customised instead
// of having to be created first and customised in a second save.
const PouchStrapSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  hex: z.string().trim().optional().nullable(),
  sort: z.coerce.number().int().optional().default(0),
  mainImageUrl: OptionalImagePath,
})

const PouchSchema = z.object({
  id: z.string().optional(),
  color: z.string().trim().min(1),
  hex: z.string().trim().optional().nullable(),
  liqpayGoodId: NullableIntSchema.optional(),
  extraPriceUAH: z.coerce.number().int().min(0).optional().default(0),
  sort: z.coerce.number().int().optional().default(0),
  imageUrl: OptionalImagePath,
  straps: z.array(PouchStrapSchema).optional().default([]),
})

const SizeSchema = z.object({
  id: z.string().optional(),
  size: z.string().trim().min(1),
  liqpayGoodId: NullableIntSchema.optional(),
  extraPriceUAH: z.coerce.number().int().min(0).optional().default(0),
  sort: z.coerce.number().int().optional().default(0),
  imageUrl: OptionalImagePath,
})

const NullablePriceSchema = z.preprocess(
  (value) => {
    if (value === '' || value == null) return null
    const num = Number(value)
    return Number.isFinite(num) ? num : value
  },
  z.number().int().min(0).nullable(),
)

// --------- Zod schema for product creation (incl. variants, but without straps/addons/images relations) ---------
const ProductCreateSchema = z.object({
  name: z.string().trim().min(1),
  nameEn: z.string().trim().optional().nullable(),
  slug: z.string().trim().min(1),
  type: z.enum(ProductType),
  status: z.nativeEnum(ProductStatus).optional().default(ProductStatus.DRAFT),
  // allow missing or null (DB can store null)
  group: z.enum(ProductGroup).nullable().optional(),
  sortCatalog: z.coerce.number().int().optional().nullable(),

  basePriceUAH: NullablePriceSchema.optional(),
  basePriceUSD: NullablePriceSchema.optional(),
  info: z.string().trim().optional().nullable(),
  infoEn: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  descriptionEn: z.string().trim().optional().nullable(),
  dimensions: z.string().trim().optional().nullable(),
  dimensionsEn: z.string().trim().optional().nullable(),
  offerNote: z.string().trim().optional().nullable(),
  offerNoteEn: z.string().trim().optional().nullable(),
  inStock: z.coerce.boolean(),

  variants: z
    .array(
      z.object({
        color: z.string().trim().optional().nullable(),
        colorEn: z.string().trim().optional().nullable(),
        modelSize: z.string().trim().optional().nullable(),
        pouchColor: z.string().trim().optional().nullable(),
        hex: z.string().trim().optional().nullable(),
        // in our project we often store local paths
        image: OptionalImagePath,
        images: z.array(ImagePath).optional().default([]),

        priceUAH: NullablePriceSchema,
        priceUSD: NullablePriceSchema,
        discountPercent: z.coerce.number().optional().nullable(),
        discountUAH: z.coerce.number().optional().nullable(),
        sortCatalog: z.coerce.number().int().optional().nullable(),
        availabilityStatus: z.enum(AvailabilityStatus).optional().nullable(),
        inStock: z.coerce.boolean(),
        // Unique in the database, so "not filled in" has to stay NULL: two
        // variants saved with '' would collide (P2002).
        sku: OptionalText,
        liqpayGoodId: NullableIntSchema.optional(),

        // Optional per-variant shipping text (e.g. "Відправка протягом 1–3 днів")
        shippingNote: z.string().trim().optional().nullable(),
        pouchStrapCustomization: z.coerce.boolean().optional().default(false),
        straps: z.array(StrapSchema).optional().default([]),
        pouches: z.array(PouchSchema).optional().default([]),
        sizes: z.array(SizeSchema).optional().default([]),
      }),
    )
    .min(1, 'At least one variant is required'),
})

function sanitizeDiscountPercent(input: number | null | undefined) {
  if (typeof input !== 'number' || !Number.isFinite(input)) return null
  return Math.max(0, Math.min(100, Math.round(input)))
}

function sanitizeSortCatalog(input: number | null | undefined) {
  if (typeof input !== 'number' || !Number.isFinite(input)) return 0
  return Math.max(0, Math.round(input))
}

// --------- GET: list products for admin ---------
export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  try {
    const products = await prisma.product.findMany({
      orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        nameEn: true,
        slug: true,
        type: true,
        status: true,
        group: true,
        sortCatalog: true,
        inStock: true,
        basePriceUAH: true,
        basePriceUSD: true,
        offerNote: true,
        offerNoteEn: true,
        createdAt: true,
        updatedAt: true,
        variants: {
          orderBy: [{ sortCatalog: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            color: true,
            colorEn: true,
            modelSize: true,
            pouchColor: true,
            hex: true,
            image: true,
            priceUAH: true,
            priceUSD: true,
            discountPercent: true,
            discountUAH: true,
            inStock: true,
            availabilityStatus: true,
            sku: true,
            liqpayGoodId: true,
          },
        },
      },
    })

    return NextResponse.json({ products }, { status: 200 })
  } catch (err) {
    console.error('Admin products list error:', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}

// --------- POST: create product ---------
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  try {
    const json = await req.json()
    const parsed = ProductCreateSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const data = parsed.data
    const normalizedType =
      data.type === 'ORNAMENTS' ? 'ACCESSORY' : data.type

    const created = await prisma.product.create({
      data: {
        name: data.name,
        nameEn: data.nameEn ?? null,
        slug: data.slug,
        type: normalizedType,
        // New products should be immediately available as addon candidates.
        isAddon: true,
        status: data.status,
        group: data.group ?? null,
        sortCatalog: sanitizeSortCatalog(data.sortCatalog),
        basePriceUAH: data.basePriceUAH ?? null,
        basePriceUSD: data.basePriceUSD ?? null,
        description: data.description ?? null,
        descriptionEn: data.descriptionEn ?? null,
        info: data.info ?? null,
        infoEn: data.infoEn ?? null,
        dimensions: data.dimensions ?? null,
        dimensionsEn: data.dimensionsEn ?? null,
        offerNote: data.offerNote ?? null,
        offerNoteEn: data.offerNoteEn ?? null,
        inStock: data.inStock,

        variants: {
          create: data.variants.map((v) => {
            const availabilityStatus = resolveAvailabilityStatus({
              availabilityStatus: v.availabilityStatus,
              inStock: v.inStock,
            })

            return {
              color: v.color ?? null,
              colorEn: v.colorEn ?? null,
              modelSize: v.modelSize?.trim() || null,
              pouchColor: v.pouchColor?.trim() || null,
              hex: v.hex ?? null,
              image: v.image ?? null,
              images: {
                create: (v.images ?? []).map((url) => ({ url })),
              },
              priceUAH: v.priceUAH ?? null,
              priceUSD: v.priceUSD ?? null,
              discountPercent: sanitizeDiscountPercent(v.discountPercent),
              discountUAH: v.discountUAH ?? null,
              sortCatalog: sanitizeSortCatalog(v.sortCatalog),
              inStock: isInStockStatus(availabilityStatus),
              availabilityStatus,
              sku: v.sku ?? null,
              liqpayGoodId: v.liqpayGoodId ?? null,
              shippingNote: v.shippingNote ?? null,
              straps: {
                create: (v.straps ?? []).map((s, strapIdx) => ({
                  name: s.name,
                  liqpayGoodId: s.liqpayGoodId ?? null,
                  extraPriceUAH: s.extraPriceUAH ?? 0,
                  sort: s.sort ?? strapIdx,
                  imageUrl: s.imageUrl ?? null,
                })),
              },
              pouchStrapCustomization: v.pouchStrapCustomization,
              pouches: {
                create: (v.pouches ?? []).map((pouch, pouchIdx) => ({
                  color: pouch.color,
                  hex: pouch.hex || null,
                  liqpayGoodId: pouch.liqpayGoodId ?? null,
                  extraPriceUAH: pouch.extraPriceUAH ?? 0,
                  sort: pouch.sort ?? pouchIdx,
                  imageUrl: pouch.imageUrl ?? null,
                  straps: v.pouchStrapCustomization
                    ? {
                        create: (pouch.straps ?? []).map((strap, strapIdx) => ({
                          name: strap.name,
                          hex: strap.hex ?? null,
                          sort: strap.sort ?? strapIdx,
                          mainImageUrl: strap.mainImageUrl ?? null,
                        })),
                      }
                    : undefined,
                })),
              },
              sizes: {
                create: (v.sizes ?? []).map((size, sizeIdx) => ({
                  size: size.size,
                  liqpayGoodId: size.liqpayGoodId ?? null,
                  extraPriceUAH: size.extraPriceUAH ?? 0,
                  sort: size.sort ?? sizeIdx,
                  imageUrl: size.imageUrl ?? null,
                })),
              },

            }
          }),
        },
      },
      select: { id: true, slug: true, type: true, group: true, status: true },
    })

    revalidateProductCache({
      reason: 'create',
      after: {
        slug: created.slug,
        type: created.type,
        group: created.group,
        status: created.status,
      },
    })

    return NextResponse.json({ id: created.id }, { status: 201 })
  } catch (err) {
    console.error('Create product error:', err)

    // Name the field that actually collided (Prisma error code P2002). Reading
    // every unique conflict as a slug conflict sent admins hunting for a
    // duplicate URL when the real culprit was a repeated SKU.
    const isUniqueConflict =
      typeof err === 'object' &&
      err &&
      'code' in err &&
      (err as any).code === 'P2002'
    const target = String((err as any)?.meta?.target ?? '')

    let msg = err instanceof Error ? err.message : 'Internal Server Error'
    if (isUniqueConflict) {
      msg = target.includes('slug')
        ? 'Product with this slug already exists'
        : `Duplicate value for a unique field: ${target || 'unknown'}`
    }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
