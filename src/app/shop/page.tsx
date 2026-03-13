import ProductsContainer from '@/components/product/ProductsContainer'
import { Suspense } from 'react'
import { getProductsLite } from '@/lib/db/products'
import type { ProductType } from '@prisma/client'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ACTIVE_PRODUCT_TYPES } from '@/lib/labels'
import { ACCESSORY_SUBCATEGORIES } from '@/lib/shop-taxonomy'

export const revalidate = 300

const ALLOWED_TYPES: ProductType[] = ACTIVE_PRODUCT_TYPES
type ProductGroup = '' | 'BEADS' | 'WEAVING'
type ShopSearchParams = {
  q?: string
  color?: string
  type?: string
  group?: string
}

const TYPE_TO_CATEGORY: Record<ProductType, string> = {
  BAG: 'sumky',
  BELT_BAG: 'bananky',
  BACKPACK: 'rjukzachky',
  SHOPPER: 'shopery',
  CASE: 'chohly',
  ORNAMENTS: 'accessories',
  ACCESSORY: 'accessories',
}

function normalizeGroup(raw?: string | null): ProductGroup {
  if (!raw) return ''
  const v = raw.trim().toLowerCase()
  if (v === 'beads' || v === 'bead' || v === 'бісер' || v === 'biser')
    return 'BEADS'
  if (v === 'weaving' || v === 'плетіння' || v === 'pletinnya')
    return 'WEAVING'
  return ''
}

function normalizeType(raw?: string | null): ProductType | null {
  if (!raw) return null
  const t = raw.toUpperCase() as ProductType
  if (t === 'ORNAMENTS') return 'ACCESSORY'
  return ALLOWED_TYPES.includes(t) ? t : null
}

function canonicalForShopFilters(sp: ShopSearchParams): string {
  const safeType = normalizeType(sp.type ?? null)
  const safeGroup = normalizeGroup(sp.group ?? null)

  // If type/group are combined, keep canonical at /shop to avoid ambiguous mapping.
  if (safeType && safeGroup) return '/shop'

  if (safeType) return `/shop/${TYPE_TO_CATEGORY[safeType]}`
  if (safeGroup) return `/shop/group/${safeGroup.toLowerCase()}`
  return '/shop'
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>
}): Promise<Metadata> {
  const sp = await searchParams
  return {
    title: 'Каталог сумок ручної роботи та аксесуарів',
    description:
      'Каталог GERDAN: сумки ручної роботи, сумки з бісеру, плетені сумки, чохли та аксесуари.',
    alternates: {
      canonical: canonicalForShopFilters(sp),
    },
  }
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>
}) {
  const sp = await searchParams
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

  const products = await getProductsLite({
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
          accessorySubcategoryOptions={ACCESSORY_SUBCATEGORIES.map((item) => ({
            value: item.slug,
            label: item.label,
          }))}
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
