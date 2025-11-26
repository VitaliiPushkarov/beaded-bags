import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { ProductType } from '@prisma/client'

// --------- Zod-схема продукту (БЕЗ variants) ---------
const ProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  type: z.nativeEnum(ProductType),
  variants: z.array(
    z.object({
      color: z.string().optional().nullable(),
      hex: z.string().optional().nullable(),
      image: z.string().url().optional().nullable(),
      priceUAH: z.number(),
      inStock: z.boolean(),
      sku: z.string().optional().nullable(),
    })
  ),
  basePriceUAH: z.number().nullable(),
  description: z.string().optional().nullable(),
  inStock: z.boolean(),
  images: z.array(z.string().url()).optional().default([]),
})

// --------- POST: створення товару ---------
export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = ProductSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data

    const created = await prisma.product.create({
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

    return NextResponse.json({ id: created.id }, { status: 201 })
  } catch (err) {
    console.error('Create product error:', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
