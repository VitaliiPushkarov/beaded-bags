import { prisma } from '@/lib/prisma'
import { Prisma, ProductType } from '@prisma/client'
import { toDbTypePrisma } from '@/lib/labels'

export type CatalogFilters = {
  search?: string
  type?: string | null
  color?: string | null
}

export async function getProducts(filters: CatalogFilters = {}) {
  const where: Prisma.ProductWhereInput = {}

  if (filters.search?.trim()) {
    where.OR = [
      { name: { contains: filters.search.trim(), mode: 'insensitive' } },
      { description: { contains: filters.search.trim(), mode: 'insensitive' } },
    ]
  }

  // ✓ Конвертуємо у справжній enum Prisma
  const typeEnum: ProductType | undefined = toDbTypePrisma(
    filters.type ?? undefined
  )
  if (typeEnum) where.type = typeEnum

  if (filters.color) {
    where.variants = {
      some: { color: { equals: filters.color, mode: 'insensitive' } },
    }
  }

  const items = await prisma.product.findMany({
    where,
    include: { variants: { orderBy: { id: 'asc' } } },
    orderBy: { id: 'desc' },
  })

  return items
}
