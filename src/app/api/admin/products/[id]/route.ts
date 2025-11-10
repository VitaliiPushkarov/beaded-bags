import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ProductType } from '@prisma/client'

// --------- Zod-схеми ---------
const VariantSchema = z.object({
  id: z.string().optional(),
  color: z.string().optional().nullable(),
  hex: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  priceUAH: z.number().nullable(),
  inStock: z.boolean(),
  sku: z.string().optional().nullable(),
})

const ProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  type: z.nativeEnum(ProductType),
  basePriceUAH: z.number().nullable(),
  description: z.string().optional().nullable(),
  inStock: z.boolean(),
  variants: z.array(VariantSchema).min(1),
})

// --------- PATCH: оновлення товару ---------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // 1) чистимо старі варіанти
    await prisma.productVariant.deleteMany({
      where: { productId: id },
    })

    // 2) оновлюємо сам продукт + створюємо нові варіанти
    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        type: data.type,
        basePriceUAH: data.basePriceUAH,
        description: data.description ?? null,
        inStock: data.inStock,
        variants: {
          create: data.variants.map((v) => ({
            color: v.color ?? null,
            hex: v.hex ?? null,
            image: v.image ?? null,
            priceUAH: v.priceUAH,
            inStock: v.inStock,
            sku: v.sku ?? null,
          })),
        },
      },
    })

    return NextResponse.json({ id: updated.id }, { status: 200 })
  } catch (err) {
    console.error('Update product error:', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// --------- DELETE: видалення товару ---------
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.product.delete({ where: { id } })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('Delete product error:', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

// --------- GET: один товар ---------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const product = await prisma.product.findUnique({
      where: { id },
      include: { variants: { orderBy: { id: 'asc' } } },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (err) {
    console.error('GET product error', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
