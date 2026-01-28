import ProductsContainer from '@/components/product/ProductsContainer'
import { Suspense } from 'react'
import { getProducts } from '@/lib/db/products'
import type { ProductType } from '@prisma/client'
import Link from 'next/link'

export const revalidate = 60

const ALLOWED_TYPES: ProductType[] = [
  'BAG',
  'BACKPACK',
  'SHOPPER',
  'CASE',
  'BELT_BAG',
  'ORNAMENTS',
  'ACCESSORY',
]
type ProductGroup = '' | 'BEADS' | 'WEAVING'

function normalizeGroup(raw?: string | null): ProductGroup {
  if (!raw) return ''
  const v = raw.toLowerCase()
  if (v === 'бісер' || v === 'biser') return 'BEADS'
  if (v === 'плетіння' || v === 'pletinnya') return 'WEAVING'
  return ''
}

function normalizeType(raw?: string | null): ProductType | null {
  if (!raw) return null
  const t = raw.toUpperCase() as ProductType
  return ALLOWED_TYPES.includes(t) ? t : null
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams?: {
    q?: string
    color?: string
    type?: string
    group?: string
  }
}) {
  const sp = searchParams ?? {}
  const safeType = normalizeType(sp.type ?? null)
  const safeGroup = normalizeGroup(sp.group ?? null)

  if (sp.type && !safeType) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-semibold mb-4">
          Категорія скоро буде доступна
        </h1>
        <p className="text-gray-600 mb-6">
          Ви перейшли за посиланням на категорію, яку ми ще не додали в каталог.
          Оберіть інший розділ або перегляньте всі товари.
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
    type: safeType ?? undefined,
    group: safeGroup || undefined,
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.slice(0, 24).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://gerdan.online/products/${p.slug}`,
    })),
  }

  return (
    <>
      <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-8" />}>
        <ProductsContainer
          initialProducts={products}
          initialFilters={{
            q: sp.q ?? '',
            color: sp.color ?? '',
            bagTypes: safeType ?? '',
            group: safeGroup,
          }}
        />
      </Suspense>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  )
}
