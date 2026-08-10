import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma, ProductType } from '@prisma/client'
import {
  isPrismaAvailabilityError,
  withPrismaRetry,
} from '@/lib/prisma-resilience'
import {
  SUBCATEGORY_CANDIDATE_TYPES,
  resolveRecommendation,
} from '@/lib/recommendation-matrix'
import { getRecommendationMatrix } from '@/lib/recommendation-settings'
import { matchAccessorySubcategory } from '@/lib/shop-taxonomy'

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim()
  const lite = searchParams.get('lite') === '1'

  try {
    // Search mode for header dialog
    if (search) {
      const limit = clamp(Number(searchParams.get('limit') ?? 20) || 20, 1, 50)

      const where: Prisma.ProductWhereInput = {
        status: 'PUBLISHED',
        OR: [
          {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            nameEn: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            slug: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            variants: {
              some: {
                OR: [
                  {
                    color: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    colorEn: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                ],
              },
            },
          },
        ],
      }

      const [items, total] = await withPrismaRetry(
        () =>
          prisma.$transaction([
            prisma.product.findMany({
              where,
              take: limit,
              orderBy: [{ sortCatalog: 'asc' }, { createdAt: 'desc' }],
              select: {
                id: true,
                slug: true,
                name: true,
                nameEn: true,
                basePriceUAH: true,
                basePriceUSD: true,
                variants: {
                  take: 1,
                  orderBy: [{ sortCatalog: 'asc' }, { id: 'asc' }],
                  select: {
                    image: true,
                    priceUAH: true,
                    priceUSD: true,
                    images: {
                      take: 1,
                      orderBy: { sort: 'asc' },
                      select: { url: true },
                    },
                  },
                },
              },
            }),
            prisma.product.count({ where }),
          ]),
        { scope: 'api.products.search.transaction' },
      )

      return NextResponse.json({ items, total })
    }

    // Lightweight mode for recommendations / YouMayAlsoLike
    if (lite) {
      const limit = clamp(Number(searchParams.get('limit') ?? 20) || 20, 1, 60)
      const discounted = searchParams.get('discounted') === '1'

      const excludeSlug = searchParams.get('excludeSlug')?.trim()
      const excludeId = searchParams.get('excludeId')?.trim()
      // Category of the product being viewed. The admin-configured matrix
      // decides which categories may be recommended for it; previously this
      // branch matched "same type OR same group" with the rule hardcoded.
      const recommendFor = searchParams.get('recommendFor')?.trim()

      const where: Prisma.ProductWhereInput = {
        status: 'PUBLISHED',
      }

      // Subcategory columns are keyword-matched after the query, so the SQL
      // fetches a superset and the rows get filtered below.
      let recommendedSubcategories: string[] = []
      let recommendedWholeTypes: ProductType[] = []

      if (recommendFor) {
        const matrix = await getRecommendationMatrix()
        const resolved = resolveRecommendation(matrix, recommendFor)
        recommendedWholeTypes = resolved.types
        recommendedSubcategories = resolved.subcategories

        // An empty row means the owner switched the block off for this
        // category, so return nothing rather than falling back to everything.
        if (
          recommendedWholeTypes.length === 0 &&
          recommendedSubcategories.length === 0
        ) {
          return NextResponse.json({ items: [] })
        }

        const candidateTypes = new Set<ProductType>(recommendedWholeTypes)
        if (recommendedSubcategories.length > 0) {
          for (const type of SUBCATEGORY_CANDIDATE_TYPES) {
            candidateTypes.add(type)
          }
        }

        where.type = { in: Array.from(candidateTypes) }
      }

      if (excludeId || excludeSlug) {
        where.NOT = [
          ...(excludeId ? [{ id: excludeId }] : []),
          ...(excludeSlug ? [{ slug: excludeSlug }] : []),
        ]
      }

      if (discounted) {
        where.variants = {
          some: {
            OR: [{ discountPercent: { gt: 0 } }, { discountUAH: { gt: 0 } }],
          },
        }
      }

      const discountedVariantWhere = discounted
        ? {
            OR: [{ discountPercent: { gt: 0 } }, { discountUAH: { gt: 0 } }],
          }
        : undefined

      // With subcategory columns the keyword filter runs after the query, so the
      // fetch has to be a superset or matches past the first `limit` rows would
      // be lost. The catalogue is small enough that a generous cap is cheap.
      const fetchTake = recommendedSubcategories.length > 0 ? 200 : limit

      const items = await withPrismaRetry(
        () =>
          prisma.product.findMany({
            where,
            take: fetchTake,
            orderBy: [{ createdAt: 'desc' }],
            select: {
              id: true,
              slug: true,
              name: true,
              nameEn: true,
              type: true,
              group: true,
              basePriceUAH: true,
              basePriceUSD: true,
              offerNote: true,
              offerNoteEn: true,
              createdAt: true,
              variants: {
                where: discountedVariantWhere,
                take: 6,
                orderBy: [{ sortCatalog: 'asc' }, { id: 'asc' }],
                select: {
                  id: true,
                  color: true,
                  colorEn: true,
                  image: true,
                  priceUAH: true,
                  priceUSD: true,
                  discountPercent: true,
                  discountUAH: true,
                  inStock: true,
                  availabilityStatus: true,
                  sortCatalog: true,
                  images: {
                    take: 1,
                    orderBy: { sort: 'asc' },
                    select: { url: true },
                  },
                },
              },
            },
          }),
        { scope: 'api.products.lite.findMany' },
      )

      if (recommendedSubcategories.length === 0) {
        return NextResponse.json({ items })
      }

      // Same keyword rule the /shop/accessories/[subcategory] pages use, so the
      // block and the catalogue always agree on what a "брелок" is. It has to run
      // in JS: matchAccessorySubcategory strips apostrophes before comparing, and
      // a SQL `contains` would miss "в'язана" for the keyword "вязан".
      const wholeTypes = new Set(recommendedWholeTypes)
      const subcategoryTypes = new Set<ProductType>(SUBCATEGORY_CANDIDATE_TYPES)

      const filtered = items
        .filter((item) => {
          if (wholeTypes.has(item.type)) return true
          if (!subcategoryTypes.has(item.type)) return false
          return recommendedSubcategories.some((slug) =>
            matchAccessorySubcategory(item, slug),
          )
        })
        .slice(0, limit)

      return NextResponse.json({ items: filtered })
    }
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Number(limitParam) : null

    const where: Prisma.ProductWhereInput = {
      status: 'PUBLISHED',
    }
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

    const products = await withPrismaRetry(
      () =>
        prisma.product.findMany({
          where,
          include: {
            variants: {
              orderBy: [{ sortCatalog: 'asc' }, { id: 'asc' }],
              include: {
                images: true,
                straps: {
                  orderBy: { sort: 'asc' },
                  include: {
                    images: {
                      orderBy: { sort: 'asc' },
                    },
                  },
                },
                pouches: {
                  orderBy: { sort: 'asc' },
                  include: {
                    images: {
                      orderBy: { sort: 'asc' },
                    },
                  },
                },
                sizes: {
                  orderBy: { sort: 'asc' },
                  include: {
                    images: {
                      orderBy: { sort: 'asc' },
                    },
                  },
                },
                addonsOnVariant: {
                  where: {
                    addonVariant: {
                      is: {
                        inStock: true,
                        availabilityStatus: 'IN_STOCK',
                        product: {
                          is: {
                            status: 'PUBLISHED',
                            inStock: true,
                          },
                        },
                      },
                    },
                  },
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
        }),
      { scope: 'api.products.default.findMany' },
    )

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
  } catch (error) {
    if (isPrismaAvailabilityError(error)) {
      console.error(
        '[db] /api/products fallback due to Prisma availability issue.',
        error,
      )

      if (search) return NextResponse.json({ items: [], total: 0 })
      if (lite) return NextResponse.json({ items: [] })
      return NextResponse.json([])
    }

    console.error('[api] Unexpected /api/products error.', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
