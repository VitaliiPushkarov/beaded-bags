import { prisma } from '@/lib/prisma'
import type { Prisma, ProductType } from '@prisma/client'
import type { ProductCardDTO } from '@/lib/product-card-dto'
import {
  isPrismaAvailabilityError,
  withPrismaRetry,
} from '@/lib/prisma-resilience'

type GetProductsParams = {
  search?: string
  color?: string
  type?: ProductType
  types?: ProductType[]
  group?: '' | 'BEADS' | 'WEAVING'
  forSlider?: boolean
  forBestsellers?: boolean
  onSale?: boolean
  take?: number
}

const PRODUCT_PAGE_INCLUDE = {
  variants: {
    orderBy: [{ sortCatalog: 'asc' }, { id: 'asc' }],
    include: {
      images: {
        orderBy: { sort: 'asc' },
      },
      straps: {
        include: {
          images: {
            orderBy: { sort: 'asc' },
          },
        },
      },
      pouches: {
        include: {
          images: {
            orderBy: { sort: 'asc' },
          },
        },
      },
      sizes: {
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
} satisfies Prisma.ProductInclude

const PRODUCT_CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  nameEn: true,
  type: true,
  group: true,
  inStock: true,
  offerNote: true,
  offerNoteEn: true,
  basePriceUAH: true,
  basePriceUSD: true,
  variants: {
    orderBy: [{ sortCatalog: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      color: true,
      colorEn: true,
      hex: true,
      image: true,
      priceUAH: true,
      priceUSD: true,
      discountPercent: true,
      discountUAH: true,
      inStock: true,
      availabilityStatus: true,
      images: {
        orderBy: { sort: 'asc' },
        take: 4,
        select: {
          url: true,
          hover: true,
          sort: true,
        },
      },
    },
  },
} satisfies Prisma.ProductSelect

function withAccessoryCompatType(type: ProductType): ProductType[] {
  return type === 'ACCESSORY' ? ['ACCESSORY', 'ORNAMENTS'] : [type]
}

function withAccessoryCompatTypes(types: ProductType[]): ProductType[] {
  const expanded = types.flatMap(withAccessoryCompatType)
  return Array.from(new Set(expanded))
}

function buildWhere(params: GetProductsParams): Prisma.ProductWhereInput {
  const { search, color, type, types, group, forBestsellers, onSale } = params

  const where: Prisma.ProductWhereInput = {
    status: 'PUBLISHED',
  }
  const andFilters: Prisma.ProductWhereInput[] = []

  // Filter by type
  if (types && types.length > 0) {
    where.type = { in: withAccessoryCompatTypes(types) }
  } else if (type) {
    const compatTypes = withAccessoryCompatType(type)
    where.type = compatTypes.length === 1 ? compatTypes[0] : { in: compatTypes }
  }

  // Filter by group
  if (group === 'BEADS') {
    where.group = 'BEADS'
  } else if (group === 'WEAVING') {
    where.group = 'WEAVING'
  }

  // Search
  if (search && search.trim()) {
    const q = search.trim()
    andFilters.push({
      OR: [
        {
          name: {
            contains: q,
            mode: 'insensitive',
          },
        },
        {
          nameEn: {
            contains: q,
            mode: 'insensitive',
          },
        },
        {
          slug: {
            contains: q,
            mode: 'insensitive',
          },
        },
        {
          variants: {
            some: {
              OR: [
                {
                  color: {
                    contains: q,
                    mode: 'insensitive',
                  },
                },
                {
                  colorEn: {
                    contains: q,
                    mode: 'insensitive',
                  },
                },
              ],
            },
          },
        },
      ],
    })
  }

  // Variant color filter
  if (color && color.trim()) {
    const colorValue = color.trim()
    andFilters.push({
      variants: {
        some: {
          OR: [{ color: colorValue }, { colorEn: colorValue }],
        },
      },
    })
  }

  // Bestseller filter → now based on variants.sortBestsellers
  if (forBestsellers) {
    andFilters.push({
      variants: {
        some: {
          sortBestsellers: { gt: 0 },
        },
      },
    })
  }

  // Sale filter → any variant has a discount
  if (onSale) {
    andFilters.push({
      variants: {
        some: {
          OR: [{ discountPercent: { gt: 0 } }, { discountUAH: { gt: 0 } }],
        },
      },
    })
  }

  if (andFilters.length > 0) {
    where.AND = andFilters
  }

  return where
}

function buildOrderBy(
  params: GetProductsParams
): Prisma.ProductOrderByWithRelationInput[] {
  const { forSlider } = params

  const orderBy: Prisma.ProductOrderByWithRelationInput[] = []

  if (forSlider) {
    orderBy.push({ sortSlider: 'asc' })
  } else {
    orderBy.push({ sortCatalog: 'asc' })
  }

  // fallback
  orderBy.push({ createdAt: 'desc' })

  return orderBy
}

export async function getProductBySlug(slug: string) {
  try {
    return await withPrismaRetry(
      () =>
        prisma.product.findFirst({
          where: {
            slug,
            status: 'PUBLISHED',
          },
          include: PRODUCT_PAGE_INCLUDE,
        }),
      { scope: 'db.products.getProductBySlug' },
    )
  } catch (error) {
    if (isPrismaAvailabilityError(error)) {
      console.error(
        `[db] getProductBySlug fallback for slug="${slug}" due to DB availability issue.`,
        error,
      )
      return null
    }
    throw error
  }
}

export async function getProductMetaBySlug(slug: string) {
  try {
    return await withPrismaRetry(
      () =>
        prisma.product.findFirst({
          where: {
            slug,
            status: 'PUBLISHED',
          },
          select: {
            slug: true,
            name: true,
            nameEn: true,
            description: true,
            descriptionEn: true,
            variants: {
              orderBy: [{ sortCatalog: 'asc' }, { id: 'asc' }],
              select: {
                image: true,
                images: {
                  orderBy: { sort: 'asc' },
                  take: 1,
                  select: {
                    url: true,
                  },
                },
              },
            },
          },
        }),
      { scope: 'db.products.getProductMetaBySlug' },
    )
  } catch (error) {
    if (isPrismaAvailabilityError(error)) {
      console.error(
        `[db] getProductMetaBySlug fallback for slug="${slug}" due to DB availability issue.`,
        error,
      )
      return null
    }
    throw error
  }
}

export async function getProducts(params: GetProductsParams = {}) {
  const { forBestsellers } = params
  const where = buildWhere(params)
  const orderBy = buildOrderBy(params)

  let products
  try {
    products = await withPrismaRetry(
      () =>
        prisma.product.findMany({
          where,
          orderBy,
          take: params.take,
          include: PRODUCT_PAGE_INCLUDE,
        }),
      { scope: 'db.products.getProducts.findMany' },
    )
  } catch (error) {
    if (isPrismaAvailabilityError(error)) {
      console.error('[db] getProducts fallback to empty list.', error)
      return []
    }
    throw error
  }

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

// Lightweight products for catalog/home/cards (minimal payload)
export async function getProductsLite(
  params: GetProductsParams = {},
): Promise<ProductCardDTO[]> {
  const where = buildWhere(params)
  const orderBy = buildOrderBy(params)

  const take =
    typeof params.take === 'number'
      ? Math.min(Math.max(params.take, 1), 60)
      : undefined

  let items
  try {
    items = await withPrismaRetry(
      () =>
        prisma.product.findMany({
          where,
          orderBy,
          take,
          select: PRODUCT_CARD_SELECT,
        }),
      { scope: 'db.products.getProductsLite.findMany' },
    )
  } catch (error) {
    if (isPrismaAvailabilityError(error)) {
      console.error('[db] getProductsLite fallback to empty list.', error)
      return []
    }
    throw error
  }

  return items as ProductCardDTO[]
}
