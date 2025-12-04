import ProductsContainer from '@/components/product/ProductsContainer'
import { getProducts } from '@/lib/db/products'
import type { ProductType } from '@prisma/client'
import Link from 'next/link'

const MAP: Record<string, ProductType> = {
  sumky: 'BAG',
  bananky: 'BELT_BAG',
  rjukzachky: 'BACKPACK',
  shopery: 'SHOPPER',
  chohly: 'CASE',
  prykrasy: 'ORNAMENTS',
}

export default async function ShopCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  const type = MAP[category]

  // якщо такої категорії немає — показуємо м’яку заглушку (200), а не редірект
  if (!type) {
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

  const products = await getProducts({ type })

  // але: 1) передаємо lockedType, 2) початкові фільтри вже з типом
  return (
    <ProductsContainer
      initialProducts={products}
      initialFilters={{
        q: '',
        color: '',
        bagTypes: type,
      }}
      lockedType={type}
    />
  )
}
