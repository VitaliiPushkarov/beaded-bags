import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
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
