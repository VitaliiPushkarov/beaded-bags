import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ProductType, ProductGroup } from '@prisma/client'

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

// --------- Zod schema for product creation (incl. variants, but without straps/addons/images relations) ---------
const ProductCreateSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  type: z.enum(ProductType),
  // allow missing or null (DB can store null)
  group: z.enum(ProductGroup).nullable().optional(),

  basePriceUAH: z.coerce.number().nullable().optional(),
  info: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  dimensions: z.string().trim().optional().nullable(),
  inStock: z.coerce.boolean(),

  variants: z
    .array(
      z.object({
        color: z.string().trim().optional().nullable(),
        hex: z.string().trim().optional().nullable(),
        // in our project we often store local paths
        image: ImagePath.optional().nullable(),

        priceUAH: z.coerce.number(),
        discountUAH: z.coerce.number().optional().nullable(),
        inStock: z.coerce.boolean(),
        sku: z.string().trim().optional().nullable(),

        // Optional per-variant shipping text (e.g. "Відправка протягом 1–3 днів")
        shippingText: z.string().trim().optional().nullable(),
      }),
    )
    .min(1, 'At least one variant is required'),
})

// --------- GET: list products for admin ---------
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        group: true,
        inStock: true,
        basePriceUAH: true,
        createdAt: true,
        updatedAt: true,
        variants: {
          orderBy: [{ sortCatalog: 'asc' }],
          select: {
            id: true,
            color: true,
            hex: true,
            image: true,
            priceUAH: true,
            discountUAH: true,
            inStock: true,
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

    const created = await prisma.product.create({
      data: {
        name: data.name,
        slug: data.slug,
        type: data.type,
        group: data.group ?? null,
        basePriceUAH: data.basePriceUAH ?? null,
        description: data.description ?? null,
        info: data.info ?? null,
        dimensions: data.dimensions ?? null,
        inStock: data.inStock,

        variants: {
          create: data.variants.map((v, idx) => ({
            color: v.color ?? null,
            hex: v.hex ?? null,
            image: v.image ?? null,
            priceUAH: v.priceUAH,
            discountUAH: v.discountUAH ?? null,
            inStock: v.inStock,
            sku: v.sku ?? null,
            shippingText: v.shippingText ?? null,

            // sensible default order for new variants
            sortCatalog: idx + 1,
          })),
        },
      },
      select: { id: true },
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
