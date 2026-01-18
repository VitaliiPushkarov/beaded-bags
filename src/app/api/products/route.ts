import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  // Lightweight mode for recommendations / YouMayAlsoLike
  const lite = searchParams.get('lite') === '1'
  if (lite) {
    const limit = Math.min(
      Math.max(Number(searchParams.get('limit') ?? 20) || 20, 1),
      60
    )

    const excludeSlug = searchParams.get('excludeSlug')?.trim()
    const excludeId = searchParams.get('excludeId')?.trim()
    const type = searchParams.get('type')?.trim() || undefined
    const group = searchParams.get('group')?.trim() || undefined

    const where: Prisma.ProductWhereInput = {}

    // Soft relevance: if type/group are provided, prefer matching either of them,
    // but don't require both simultaneously.
    if (type || group) {
      where.OR = [
        ...(type ? [{ type: type as any }] : []),
        ...(group ? [{ group: group as any }] : []),
      ]
    }

    if (excludeId || excludeSlug) {
      where.NOT = [
        ...(excludeId ? [{ id: excludeId }] : []),
        ...(excludeSlug ? [{ slug: excludeSlug }] : []),
      ]
    }

    const items = await prisma.product.findMany({
      where,
      take: limit,
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        group: true,
        basePriceUAH: true,
        createdAt: true,
        variants: {
          take: 1,
          orderBy: { sortCatalog: 'asc' },
          select: {
            id: true,
            image: true,
            priceUAH: true,
            images: {
              take: 1,
              orderBy: { id: 'asc' },
              select: { url: true },
            },
          },
        },
      },
    })

    return NextResponse.json({ items })
  }
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Number(limitParam) : null

  const where: Prisma.ProductWhereInput = {}
  let orderBy: Prisma.ProductOrderByWithRelationInput[] = []

  const isBestsellers = !!limit

  if (isBestsellers) {
    where.variants = {
      some: {
        sortBestsellers: { gt: 0 },
      },
    }

    orderBy = [{ createdAt: 'desc' }]
  } else {
    where.sortSlider = { not: null, gt: 0 }
    orderBy = [{ sortSlider: 'asc' }, { createdAt: 'desc' }]
  }

  const products = await prisma.product.findMany({
    where,
    include: {
      variants: {
        orderBy: { id: 'asc' },
        include: {
          images: true,
          straps: true,
          addonsOnVariant: {
            orderBy: { sort: 'asc' },
            include: {
              addonVariant: {
                include: {
                  product: true,
                  images: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy,
  })

  // Для бестселерів сортуємо продукти за мінімальним sortBestsellers серед їхніх варіантів
  let result = products

  if (isBestsellers) {
    result = [...products].sort((a: any, b: any) => {
      const aMin =
        a.variants?.reduce((min: number, v: any) => {
          if (typeof v.sortBestsellers === 'number' && v.sortBestsellers > 0) {
            return Math.min(min, v.sortBestsellers)
          }
          return min
        }, Number.MAX_SAFE_INTEGER) ?? Number.MAX_SAFE_INTEGER

      const bMin =
        b.variants?.reduce((min: number, v: any) => {
          if (typeof v.sortBestsellers === 'number' && v.sortBestsellers > 0) {
            return Math.min(min, v.sortBestsellers)
          }
          return min
        }, Number.MAX_SAFE_INTEGER) ?? Number.MAX_SAFE_INTEGER

      return aMin - bMin
    })

    if (limit) {
      result = result.slice(0, limit)
    }
  }

  return NextResponse.json(result)
}
