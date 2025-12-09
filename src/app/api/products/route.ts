import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Number(limitParam) : null

  const where: Prisma.ProductWhereInput = {}
  let orderBy: Prisma.ProductOrderByWithRelationInput[] = []

  if (limit) {
    where.sortBestsellers = { not: null, gt: 0 }
    orderBy = [{ sortBestsellers: 'asc' }, { createdAt: 'desc' }]
  } else {
    where.sortSlider = { not: null, gt: 0 }
    orderBy = [{ sortSlider: 'asc' }, { createdAt: 'desc' }]
  }

  const products = await prisma.product.findMany({
    where,
    include: {
      variants: {
        orderBy: { id: 'asc' },
        include: { images: true, straps: true },
      },
    },
    orderBy,
    ...(limit ? { take: limit } : {}),
  })

  return NextResponse.json(products)
}
