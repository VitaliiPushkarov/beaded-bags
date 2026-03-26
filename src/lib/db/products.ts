import { prisma } from '@/lib/prisma'
import type { Prisma, ProductType } from '@prisma/client'
import type { ProductCardDTO } from '@/lib/product-card-dto'
import { resolveAvailabilityStatus } from '@/lib/availability'

type GetProductsParams = {
  search?: string
  color?: string
  type?: ProductType
  types?: ProductType[]
  group?: '' | 'BEADS' | 'WEAVING'
  forSlider?: boolean
  forBestsellers?: boolean
  take?: number
}

const PRODUCT_PAGE_INCLUDE = {
  variants: {
    orderBy: {
      id: 'asc',
    },
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
  type: true,
  group: true,
  inStock: true,
  offerNote: true,
  basePriceUAH: true,
  variants: {
    orderBy: { sortCatalog: 'asc' },
    select: {
      id: true,
      color: true,
      hex: true,
      image: true,
      priceUAH: true,
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
  const { search, color, type, types, group, forBestsellers } = params

  const where: Prisma.ProductWhereInput = {
    status: 'PUBLISHED',
  }

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

function availabilityPriority(input: {
  availabilityStatus?: ProductCardDTO['variants'][number]['availabilityStatus'] | null
  inStock?: boolean | null
}) {
  const status = resolveAvailabilityStatus({
    availabilityStatus: input.availabilityStatus,
    inStock: input.inStock,
  })

  if (status === 'IN_STOCK') return 0
  if (status === 'PREORDER') return 1
  return 2
}

function withPrioritizedCatalogVariants(
  items: ProductCardDTO[],
): ProductCardDTO[] {
  return items.map((item) => ({
    ...item,
    // Keep existing sortCatalog order inside each availability bucket.
    variants: [...(item.variants || [])].sort(
      (a, b) => availabilityPriority(a) - availabilityPriority(b),
    ),
  }))
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: {
      slug,
      status: 'PUBLISHED',
    },
    include: PRODUCT_PAGE_INCLUDE,
  })
}

export async function getProductMetaBySlug(slug: string) {
  return prisma.product.findFirst({
    where: {
      slug,
      status: 'PUBLISHED',
    },
    select: {
      slug: true,
      name: true,
      description: true,
      variants: {
        orderBy: { sortCatalog: 'asc' },
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
  })
}

export async function getProducts(params: GetProductsParams = {}) {
  const { forBestsellers } = params
  const where = buildWhere(params)
  const orderBy = buildOrderBy(params)

  const products = await prisma.product.findMany({
    where,
    orderBy,
    take: params.take,
    include: PRODUCT_PAGE_INCLUDE,
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

  const items = await prisma.product.findMany({
    where,
    orderBy,
    take,
    select: PRODUCT_CARD_SELECT,
  })

  return withPrioritizedCatalogVariants(items as ProductCardDTO[])
}
