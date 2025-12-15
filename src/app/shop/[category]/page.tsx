import ProductsContainer from '@/components/product/ProductsContainer'
import { getProducts } from '@/lib/db/products'
import type { ProductType } from '@prisma/client'
import Link from 'next/link'

const CATEGORY_META: Record<
  string,
  { type?: ProductType; group?: '' | 'BEADS' | 'WEAVING'; title: string }
> = {
  sumky: { type: 'BAG', title: 'Сумки' },
  bananky: { type: 'BELT_BAG', title: 'Бананки' },
  rjukzachky: { type: 'BACKPACK', title: 'Рюкзачки' },
  shopery: { type: 'SHOPPER', title: 'Шопери' },
  chohly: { type: 'CASE', title: 'Чохли' },
  prykrasy: { type: 'ORNAMENTS', title: 'Прикраси' },
  accessories: { type: 'ACCESSORY', title: 'Аксесуари' },
}

export default async function ShopCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>
  searchParams: Promise<{
    q?: string
    color?: string
  }>
}) {
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
