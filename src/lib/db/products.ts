import { prisma } from '@/lib/prisma'
import type { Prisma, ProductType } from '@prisma/client'

type GetProductsParams = {
  search?: string
  color?: string
  type?: ProductType
  group?: '' | 'BEADS' | 'WEAVING'
  forSlider?: boolean
  forBestsellers?: boolean
}

export async function getProducts(params: GetProductsParams = {}) {
  const { search, color, type, group, forSlider, forBestsellers } = params

  const where: Prisma.ProductWhereInput = {}

  // Filter by type
  if (type) {
    where.type = type
  }

  // Filter by group
  if (group === 'BEADS') {
    where.group = 'BEADS'
  } else if (group === 'WEAVING') {
    where.group = 'WEAVING'
  }

  // Search
  if (search && search.trim()) {
    where.name = {
      contains: search.trim(),
      mode: 'insensitive',
    }
  }

  // Variant color filter
  if (color && color.trim()) {
    where.variants = {
      some: {
        color: color.trim(),
      },
    }
  }

  // Bestseller filter → now based on variants.sortBestsellers
  if (forBestsellers) {
    where.variants = {
      some: {
        sortBestsellers: { gt: 0 },
      },
    }
  }

  // ORDERING
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = []

  if (forSlider) {
    orderBy.push({ sortSlider: 'asc' })
  } else {
    orderBy.push({ sortCatalog: 'asc' })
  }

  // fallback
  orderBy.push({ createdAt: 'desc' })

  const products = await prisma.product.findMany({
    where,
    orderBy,
    include: {
      variants: {
        orderBy: {
          sortCatalog: 'asc',
        },
        include: {
          images: true,
          straps: true,
          addonsOnVariant: {
            include: {
              addon: true,
            },
          },
        },
      },
    },
  })

  // Extra sorting for BESTSELLERS:
  // sort products by the MINIMUM sortBestsellers value across their variants
  if (forBestsellers) {
    return [...products].sort((a, b) => {
      const minA =
        a.variants?.reduce((min, v) => {
          if (typeof v.sortBestsellers === 'number' && v.sortBestsellers > 0) {
            return Math.min(min, v.sortBestsellers)
          }
          return min
        }, Number.MAX_SAFE_INTEGER) ?? Number.MAX_SAFE_INTEGER

      const minB =
        b.variants?.reduce((min, v) => {
          if (typeof v.sortBestsellers === 'number' && v.sortBestsellers > 0) {
            return Math.min(min, v.sortBestsellers)
          }
          return min
        }, Number.MAX_SAFE_INTEGER) ?? Number.MAX_SAFE_INTEGER

      return minA - minB
    })
  }

  return products
}
