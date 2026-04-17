import ProductsContainer from '@/components/product/ProductsContainer'
import { Suspense } from 'react'
import { getProductsLite } from '@/lib/db/products'
import type { ProductType } from '@prisma/client'
import Link from 'next/link'
import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'
import { ACTIVE_PRODUCT_TYPES } from '@/lib/labels'
import { ACCESSORY_SUBCATEGORIES } from '@/lib/shop-taxonomy'
import {
  hasFacetedQueryParams,
  pickFirstQueryValue,
  type QueryParamValue,
} from '@/lib/seo/faceted'
import { getRequestLocale } from '@/lib/server-locale'

export const revalidate = 300

const ALLOWED_TYPES: ProductType[] = ACTIVE_PRODUCT_TYPES
type ProductGroup = '' | 'BEADS' | 'WEAVING'
type ShopSearchParams = Record<string, QueryParamValue> & {
  q?: QueryParamValue
  color?: QueryParamValue
  type?: QueryParamValue
  group?: QueryParamValue
  subcategory?: QueryParamValue
  inStock?: QueryParamValue
  onSale?: QueryParamValue
  min?: QueryParamValue
  max?: QueryParamValue
  sortBase?: QueryParamValue
  sortPrice?: QueryParamValue
}

const TYPE_TO_CATEGORY: Record<ProductType, string> = {
  BAG: 'sumky',
  BELT_BAG: 'bananky',
  BACKPACK: 'sumky',
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
  const safeType = normalizeType(pickFirstQueryValue(sp.type))
  const safeGroup = normalizeGroup(pickFirstQueryValue(sp.group))

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
  const locale = await getRequestLocale()
  const sp = await searchParams
  const shouldNoindex = hasFacetedQueryParams(sp)
  return {
    title:
      locale === 'en'
        ? 'Catalog of Handmade Bags and Accessories'
        : 'Каталог сумок ручної роботи та аксесуарів',
    description:
      locale === 'en'
        ? 'GERDAN catalog: handmade bags, beaded bags, woven bags, cases and accessories.'
        : 'Каталог GERDAN: сумки ручної роботи, сумки з бісеру, плетені сумки, чохли та аксесуари.',
    alternates: {
      canonical: canonicalForShopFilters(sp),
    },
    robots: shouldNoindex
      ? {
          index: false,
          follow: true,
        }
      : undefined,
  }
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>
}) {
  const locale = await getRequestLocale()
  const sp = await searchParams
  const rawType = pickFirstQueryValue(sp.type)
  const rawGroup = pickFirstQueryValue(sp.group)
  const safeType = normalizeType(rawType)
  const safeGroup = normalizeGroup(rawGroup)

  const hasNonNavigationFacets = hasFacetedQueryParams(sp, [
    'q',
    'color',
    'subcategory',
    'inStock',
    'onSale',
    'min',
    'max',
    'sortBase',
    'sortPrice',
  ])

  if (!hasNonNavigationFacets) {
    if (safeType && !safeGroup) {
      permanentRedirect(`/shop/${TYPE_TO_CATEGORY[safeType]}`)
    }
    if (safeGroup && !safeType) {
      permanentRedirect(`/shop/group/${safeGroup.toLowerCase()}`)
    }
    if (safeType && safeGroup) {
      permanentRedirect('/shop')
    }
  }

  if (rawType && !safeType) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-semibold mb-4">
          {locale === 'en'
            ? 'This category will be available soon'
            : 'Категорія скоро буде доступна'}
        </h1>
        <p className="text-gray-600 mb-6">
          {locale === 'en'
            ? 'You opened a category link that is not yet in our catalog. Choose another section or browse all products.'
            : 'Ви перейшли за посиланням на категорію, яку ми ще не додали в каталог. Оберіть інший розділ або перегляньте всі товари.'}
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center rounded bg-black text-white px-4 py-2 text-sm hover:bg-neutral-800"
        >
          {locale === 'en' ? 'All products' : 'Усі товари'}
        </Link>
      </div>
    )
  }

  const products = await getProductsLite({
    search: pickFirstQueryValue(sp.q),
    color: pickFirstQueryValue(sp.color),
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
            q: pickFirstQueryValue(sp.q) ?? '',
            color: pickFirstQueryValue(sp.color) ?? '',
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
