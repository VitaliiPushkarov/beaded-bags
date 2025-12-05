import { prisma } from '@/lib/prisma'
import type { Prisma, ProductType } from '@prisma/client'

type GetProductsParams = {
  search?: string
  color?: string
  type?: ProductType
  group?: '' | 'Бісер' | 'Плетіння'
  forSlider?: boolean
  forBestsellers?: boolean
}

export async function getProducts(params: GetProductsParams = {}) {
  const { search, color, type, group, forSlider, forBestsellers } = params

  const where: Prisma.ProductWhereInput = {}

  // 🔹 Фільтр по типу (Сумки / Бананки / Чохли...)
  if (type) {
    where.type = type
  }

  // 🔹 Фільтр по групі (Бісер / Плетіння), якщо ти завів поле group у Product
  if (group === 'Бісер') {
    where.group = 'BEADS' // або як ти назвав enum/поле в БД
  } else if (group === 'Плетіння') {
    where.group = 'WEAVING'
  }

  // 🔹 Пошук по назві
  if (search && search.trim()) {
    where.name = {
      contains: search.trim(),
      mode: 'insensitive',
    }
  }

  // 🔹 Фільтр по кольору (варіанти)
  if (color && color.trim()) {
    where.variants = {
      some: {
        color: color.trim(),
      },
    }
  }

  // 🔹 Сортування — але БЕЗ втрати where
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = []

  if (forSlider) {
    // поле в БД: sortSlider
    orderBy.push({ sortSlider: 'asc' })
  } else if (forBestsellers) {
    // поле в БД: sortBestsellers
    orderBy.push({ sortBestsellers: 'asc' })
  } else {
    // дефолтний порядок каталогу
    orderBy.push({ sortCatalog: 'asc' })
  }

  // запасний порядок — за датою
  orderBy.push({ createdAt: 'desc' })

  const products = await prisma.product.findMany({
    where,
    orderBy,
    include: {
      variants: {
        orderBy: {
          sortCatalog: 'asc',
        },
      },
    },
  })

  return products
}
