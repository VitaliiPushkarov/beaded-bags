import { NextRequest, NextResponse } from 'next/server'
import { ProductStatus } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { revalidateProductCache } from '@/lib/revalidate-products'

const BodySchema = z.object({
  status: z.nativeEnum(ProductStatus),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const parsed = BodySchema.safeParse(await req.json())

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true, slug: true, type: true, group: true, status: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (existing.status === parsed.data.status) {
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    await prisma.product.update({
      where: { id },
      data: { status: parsed.data.status },
    })

    revalidateProductCache({
      reason: 'update',
      before: existing,
      after: {
        slug: existing.slug,
        type: existing.type,
        group: existing.group,
        status: parsed.data.status,
      },
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error('Quick product status update error:', error)
    return NextResponse.json(
      { error: 'Failed to update product status' },
      { status: 500 },
    )
  }
}
