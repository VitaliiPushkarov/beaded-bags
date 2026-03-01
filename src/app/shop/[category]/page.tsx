import ProductsContainer from '@/components/product/ProductsContainer'
import { getProducts } from '@/lib/db/products'
import type { ProductType } from '@prisma/client'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const revalidate = 300

const CATEGORY_META: Record<
  string,
  {
    type?: ProductType
    group?: '' | 'BEADS' | 'WEAVING'
    title: string
    description: string
  }
> = {
  sumky: {
    type: 'BAG',
    title: 'Сумки',
    description: 'Каталог сумок GERDAN ручної роботи.',
  },
  bananky: {
    type: 'BELT_BAG',
    title: 'Бананки',
    description: 'Каталог бананок GERDAN ручної роботи.',
  },
  rjukzachky: {
    type: 'BACKPACK',
    title: 'Рюкзачки',
    description: 'Каталог рюкзачків GERDAN ручної роботи.',
  },
  shopery: {
    type: 'SHOPPER',
    title: 'Шопери',
    description: 'Каталог шоперів GERDAN ручної роботи.',
  },
  chohly: {
    type: 'CASE',
    title: 'Чохли',
    description: 'Каталог чохлів GERDAN ручної роботи.',
  },
  prykrasy: {
    type: 'ORNAMENTS',
    title: 'Прикраси',
    description: 'Каталог прикрас GERDAN ручної роботи.',
  },
  accessories: {
    type: 'ACCESSORY',
    title: 'Аксесуари',
    description: 'Каталог аксесуарів GERDAN ручної роботи.',
  },
}

type ShopCategoryPageProps = {
  params: Promise<{ category: string }>
  searchParams: Promise<{
    q?: string
    color?: string
  }>
}

export function generateStaticParams() {
  return Object.keys(CATEGORY_META).map((category) => ({ category }))
}

export async function generateMetadata({
  params,
}: ShopCategoryPageProps): Promise<Metadata> {
  const { category } = await params
  const meta = CATEGORY_META[category]

  if (!meta) {
    notFound()
  }

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `/shop/${category.toLowerCase()}`,
    },
  }
}

export default async function ShopCategoryPage({
  params,
  searchParams,
}: ShopCategoryPageProps) {
  const { category } = await params
  const sp = await searchParams
  const meta = CATEGORY_META[category]

  if (!meta) {
    notFound()
  }

  const products = await getProducts({
    search: sp.q,
    color: sp.color,
    type: meta.type,
    group: meta.group,
  })

  // але: 1) передаємо lockedType, 2) початкові фільтри вже з типом
  return (
    <ProductsContainer
      initialProducts={products}
      initialFilters={{
        q: sp.q ?? '',
        color: sp.color ?? '',
        bagTypes: meta.type ?? '',
        group: meta.group ?? '',
      }}
      lockedType={meta.type}
      title={meta.title}
    />
  )
}
