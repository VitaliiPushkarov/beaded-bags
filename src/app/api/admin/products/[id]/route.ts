import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ProductType, ProductGroup } from '@prisma/client'

const ImagePath = z
  .string()
  .trim()
  .min(1)
  .refine(
    (s) =>
      s.startsWith('/') || s.startsWith('http://') || s.startsWith('https://'),
    'Invalid image path',
  )

// --------- Zod-схеми ---------
const VariantSchema = z.object({
  id: z.string().optional(),
  color: z.string().optional().nullable(),
  hex: z.string().optional().nullable(),
  image: ImagePath.optional().nullable(),
  images: z.array(ImagePath).optional().default([]),
  priceUAH: z.coerce.number().nullable(),
  discountPercent: z.coerce.number().optional().nullable(),
  discountUAH: z.coerce.number().optional().nullable(),
  inStock: z.coerce.boolean(),
  sku: z.string().trim().optional().nullable(),
  shippingNote: z.string().trim().optional().nullable(),
})

const ProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  type: z.enum(ProductType),
  group: z.enum(ProductGroup).optional().nullable(),
  basePriceUAH: z.coerce.number().nullable(),
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

// --------- PATCH: оновлення товару ---------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const json = await req.json()
    const parsed = ProductSchema.safeParse(json)

    if (!parsed.success) {
      const flat = parsed.error.flatten()
      return NextResponse.json({ error: flat }, { status: 400 })
    }

    const data = parsed.data

    // Normalize group: allow null/undefined
    const nextGroup = (data.group ?? null) as ProductGroup | null

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
          type: data.type as ProductType,
          group: nextGroup,
          basePriceUAH: data.basePriceUAH,
          description: data.description ?? null,
          info: data.info ?? null,
          dimensions: data.dimensions || null,
          offerNote: data.offerNote ?? null,
          inStock: data.inStock,
        },
        select: { id: true },
      })

      // 2) upsert variants
      const createdIds: string[] = []
      for (const v of data.variants) {
        if (v.id) {
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              productId: id,
              color: v.color ?? null,
              hex: v.hex ?? null,
              image: v.image ?? null,
              images: {
                deleteMany: {},
                create: (v.images ?? []).map((url) => ({ url })),
              },
              priceUAH: v.priceUAH,
              discountPercent: sanitizeDiscountPercent(v.discountPercent),
              discountUAH: v.discountUAH ?? null,
              inStock: v.inStock,
              sku: v.sku ?? null,
              shippingNote: v.shippingNote ?? null,
            },
          })
        } else {
          const created = await tx.productVariant.create({
            data: {
              productId: id,
              color: v.color ?? null,
              hex: v.hex ?? null,
              image: v.image ?? null,
              images: {
                create: (v.images ?? []).map((url) => ({ url })),
              },
              priceUAH: v.priceUAH,
              discountPercent: sanitizeDiscountPercent(v.discountPercent),
              discountUAH: v.discountUAH ?? null,
              inStock: v.inStock,
              sku: v.sku ?? null,
              shippingNote: v.shippingNote ?? null,
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

    await prisma.product.delete({ where: { id } })

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
