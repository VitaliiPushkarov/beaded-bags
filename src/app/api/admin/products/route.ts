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

// Accept both absolute URLs and local paths like "/img/foo.jpg".
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

// --------- Zod schema for product creation (incl. variants, but without straps/addons/images relations) ---------
const ProductCreateSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  type: z.enum(ProductType),
  status: z.nativeEnum(ProductStatus).optional().default(ProductStatus.DRAFT),
  // allow missing or null (DB can store null)
  group: z.enum(ProductGroup).nullable().optional(),
  sortCatalog: z.coerce.number().int().optional().nullable(),

  basePriceUAH: NullablePriceSchema.optional(),
  info: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  dimensions: z.string().trim().optional().nullable(),
  offerNote: z.string().trim().optional().nullable(),
  inStock: z.coerce.boolean(),

  variants: z
    .array(
      z.object({
        color: z.string().trim().optional().nullable(),
        modelSize: z.string().trim().optional().nullable(),
        pouchColor: z.string().trim().optional().nullable(),
        hex: z.string().trim().optional().nullable(),
        // in our project we often store local paths
        image: ImagePath.optional().nullable(),
        images: z.array(ImagePath).optional().default([]),

        priceUAH: NullablePriceSchema,
        discountPercent: z.coerce.number().optional().nullable(),
        discountUAH: z.coerce.number().optional().nullable(),
        availabilityStatus: z.enum(AvailabilityStatus).optional().nullable(),
        inStock: z.coerce.boolean(),
        sku: z.string().trim().optional().nullable(),

        // Optional per-variant shipping text (e.g. "Відправка протягом 1–3 днів")
        shippingNote: z.string().trim().optional().nullable(),
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
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        status: true,
        group: true,
        sortCatalog: true,
        inStock: true,
        basePriceUAH: true,
        offerNote: true,
        createdAt: true,
        updatedAt: true,
        variants: {
          orderBy: [{ sortCatalog: 'asc' }],
          select: {
            id: true,
            color: true,
            modelSize: true,
            pouchColor: true,
            hex: true,
            image: true,
            priceUAH: true,
            discountPercent: true,
            discountUAH: true,
            inStock: true,
            availabilityStatus: true,
            sku: true,
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
        slug: data.slug,
        type: normalizedType,
        // New products should be immediately available as addon candidates.
        isAddon: true,
        status: data.status,
        group: data.group ?? null,
        sortCatalog: sanitizeSortCatalog(data.sortCatalog),
        basePriceUAH: data.basePriceUAH ?? null,
        description: data.description ?? null,
        info: data.info ?? null,
        dimensions: data.dimensions ?? null,
        offerNote: data.offerNote ?? null,
        inStock: data.inStock,

        variants: {
          create: data.variants.map((v, idx) => {
            const availabilityStatus = resolveAvailabilityStatus({
              availabilityStatus: v.availabilityStatus,
              inStock: v.inStock,
            })

            return {
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
                create: (v.straps ?? []).map((s, strapIdx) => ({
                  name: s.name,
                  extraPriceUAH: s.extraPriceUAH ?? 0,
                  sort: s.sort ?? strapIdx,
                  imageUrl: s.imageUrl ?? null,
                })),
              },
              pouches: {
                create: (v.pouches ?? []).map((pouch, pouchIdx) => ({
                  color: pouch.color,
                  extraPriceUAH: pouch.extraPriceUAH ?? 0,
                  sort: pouch.sort ?? pouchIdx,
                  imageUrl: pouch.imageUrl ?? null,
                })),
              },
              sizes: {
                create: (v.sizes ?? []).map((size, sizeIdx) => ({
                  size: size.size,
                  extraPriceUAH: size.extraPriceUAH ?? 0,
                  sort: size.sort ?? sizeIdx,
                  imageUrl: size.imageUrl ?? null,
                })),
              },

              // sensible default order for new variants
              sortCatalog: idx + 1,
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

    // Provide a clearer error for unique slug conflicts
    // (Prisma error code P2002)
    const msg =
      typeof err === 'object' &&
      err &&
      'code' in err &&
      (err as any).code === 'P2002'
        ? 'Product with this slug already exists'
        : 'Internal Server Error'

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
