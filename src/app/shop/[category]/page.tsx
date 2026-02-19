import ProductsContainer from '@/components/product/ProductsContainer'
import { getProducts } from '@/lib/db/products'
import type { ProductType } from '@prisma/client'
import Link from 'next/link'
import type { Metadata } from 'next'

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

export async function generateMetadata({
  params,
}: ShopCategoryPageProps): Promise<Metadata> {
  const { category } = await params
  const meta = CATEGORY_META[category]

  if (!meta) {
    return {
      title: 'Категорію не знайдено',
      robots: {
        index: false,
        follow: false,
      },
    }
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

  // fallback
  if (!meta) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-semibold mb-4">
          Категорія скоро буде доступна
        </h1>
        <p className="text-gray-600 mb-6">
          Ми ще не встигли додати товари в цю категорію. Спробуйте інші розділи
          каталогу.
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center rounded bg-black text-white px-4 py-2 text-sm hover:bg-neutral-800"
        >
          Усі товари
        </Link>
      </div>
    )
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
