import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { ProductType } from '@prisma/client'

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
  type: z.custom<ProductType>(),
  basePriceUAH: z.number().nullable(),
  description: z.string().optional().nullable(),
  inStock: z.boolean(),
  variants: z.array(VariantSchema).min(1),
})
type RouteParams = { params: Promise<{ id: string }> }
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const json = await req.json()
    const parsed = ProductSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            /* formErrors: parsed.error.formErrors,
              fieldErrors: parsed.error.fieldErrors, */
          },
        },
        { status: 400 }
      )
    }

    const data = parsed.data

    await prisma.productVariant.deleteMany({
      where: { productId: id },
    })

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

    return NextResponse.json({ id: updated.id })
  } catch (err) {
    console.error('Update product error', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    await prisma.product.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Delete product error', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
