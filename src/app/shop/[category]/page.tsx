import ProductsContainer from '@/components/product/ProductsContainer'
import { getProductsLite } from '@/lib/db/products'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import {
  ACCESSORY_SUBCATEGORIES,
  getAccessorySubcategoryConfig,
  getMainShopCategorySlugs,
  getShopCategoryConfig,
} from '@/lib/shop-taxonomy'
import {
  hasFacetedQueryParams,
  pickFirstQueryValue,
  type QueryParamValue,
} from '@/lib/seo/faceted'
import { getRequestLocale } from '@/lib/server-locale'

export const revalidate = 300

function categoryTitleByLocale(category: string, locale: 'uk' | 'en'): string {
  if (locale !== 'en') return getShopCategoryConfig(category)?.title || category
  const map: Record<string, string> = {
    sumky: 'Bags',
    bananky: 'Belt Bags',
    shopery: 'Shoppers',
    chohly: 'Cases',
    accessories: 'Accessories',
    prykrasy: 'Accessories',
  }
  return map[category] || category
}

function isTruthyQueryParam(value?: string | null): boolean {
  return value === '1' || value === 'true'
}

type ShopCategoryPageProps = {
  params: Promise<{ category: string }>
  searchParams: Promise<
    Record<string, QueryParamValue> & {
      q?: QueryParamValue
      color?: QueryParamValue
      subcategory?: QueryParamValue
      inStock?: QueryParamValue
      onSale?: QueryParamValue
      min?: QueryParamValue
      max?: QueryParamValue
      sortBase?: QueryParamValue
      sortPrice?: QueryParamValue
    }
  >
}

export function generateStaticParams() {
  return getMainShopCategorySlugs().map((category) => ({ category }))
}

function buildItemListJsonLd(productSlugs: string[], title: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    itemListElement: productSlugs.slice(0, 24).map((slug, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `https://gerdan.online/products/${slug}`,
    })),
  }
}

function buildFaqJsonLd(
  faq: Array<{ question: string; answer: string }>,
): Record<string, unknown> | null {
  if (faq.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: ShopCategoryPageProps): Promise<Metadata> {
  const locale = await getRequestLocale()
  const { category } = await params
  const sp = await searchParams
  const config = getShopCategoryConfig(category)

  if (!config) {
    notFound()
  }

  if (config.redirectTo) {
    const target = getShopCategoryConfig(config.redirectTo)
    const targetPath = `/shop/${config.redirectTo}`
    return {
      title:
        locale === 'en'
          ? `${categoryTitleByLocale(config.redirectTo, locale)} | GERDAN`
          : target?.metaTitle ?? config.metaTitle,
      description:
        locale === 'en'
          ? `Browse ${categoryTitleByLocale(config.redirectTo, locale)} by GERDAN.`
          : target?.metaDescription ?? config.metaDescription,
      alternates: {
        canonical: targetPath,
      },
      robots: {
        index: false,
        follow: true,
      },
    }
  }

  const shouldNoindex = hasFacetedQueryParams(sp)

  return {
    title:
      locale === 'en'
        ? `${categoryTitleByLocale(category, locale)} | GERDAN`
        : config.metaTitle,
    description:
      locale === 'en'
        ? `Browse ${categoryTitleByLocale(category, locale)} by GERDAN.`
        : config.metaDescription,
    alternates: {
      canonical: `/shop/${category.toLowerCase()}`,
    },
    robots: shouldNoindex
      ? {
          index: false,
          follow: true,
        }
      : undefined,
  }
}

export default async function ShopCategoryPage({
  params,
  searchParams,
}: ShopCategoryPageProps) {
  const locale = await getRequestLocale()
  const { category } = await params
  const sp = await searchParams
  const config = getShopCategoryConfig(category)

  if (!config) {
    notFound()
  }

  if (config.redirectTo) {
    permanentRedirect(`/shop/${config.redirectTo}`)
  }

  const subcategoryFromQuery = pickFirstQueryValue(sp.subcategory)
  const hasExtraFacetsForAccessories = hasFacetedQueryParams(sp, [
    'q',
    'color',
    'inStock',
    'onSale',
    'min',
    'max',
    'sortBase',
    'sortPrice',
  ])
  if (
    category === 'accessories' &&
    subcategoryFromQuery &&
    getAccessorySubcategoryConfig(subcategoryFromQuery) &&
    !hasExtraFacetsForAccessories
  ) {
    permanentRedirect(`/shop/accessories/${subcategoryFromQuery}`)
  }

  const products = await getProductsLite({
    search: pickFirstQueryValue(sp.q),
    color: pickFirstQueryValue(sp.color),
    type: config.type,
    types: config.types,
    group: config.group,
    onSale: isTruthyQueryParam(pickFirstQueryValue(sp.onSale)),
  })

  const itemListLd = buildItemListJsonLd(
    products.map((item) => item.slug),
    config.title,
  )
  const faqLd = buildFaqJsonLd(config.faqs)
  const showAccessoriesSubcategories = category === 'accessories'
  const lockedTypeForPage =
    category === 'accessories' ? 'ACCESSORY' : config.type
  const accessorySubcategoryOptions = showAccessoriesSubcategories
    ? ACCESSORY_SUBCATEGORIES.map((item) => ({
        value: item.slug,
        label: item.label,
      }))
    : []

  return (
    <>
      <ProductsContainer
        initialProducts={products}
        initialFilters={{
          q: pickFirstQueryValue(sp.q) ?? '',
          color: pickFirstQueryValue(sp.color) ?? '',
          onSale: isTruthyQueryParam(pickFirstQueryValue(sp.onSale)),
          accessorySubcategory: subcategoryFromQuery ?? '',
          bagTypes: lockedTypeForPage ?? '',
          group: config.group ?? '',
        }}
        lockedType={lockedTypeForPage}
        accessorySubcategoryOptions={accessorySubcategoryOptions}
        title={categoryTitleByLocale(category, locale)}
      />

      <section className="max-w-[1440px] mx-auto px-5 md:px-[50px] pb-12 md:pb-16 md:pt-16 mt-12 md:mt-22">
        <div className=" mb-6">
          <h2 className="text-xl md:text-2xl mb-3">
            {locale === 'en'
              ? `${categoryTitleByLocale(category, locale)} by GERDAN`
              : `${config.metaTitle} від GERDAN`}
          </h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">
            {locale === 'en'
              ? 'Detailed category description in English is being prepared.'
              : config.intro}
          </p>
        </div>

        {/* {showAccessoriesSubcategories && (
          <div className="border rounded-md p-5 md:p-7 mb-6">
            <h2 className="text-xl md:text-2xl mb-3">Підкатегорії аксесуарів</h2>
            <div className="flex flex-wrap gap-2">
              {ACCESSORY_SUBCATEGORIES.map((item) => (
                <Link
                  key={item.slug}
                  href={`/shop/accessories/${item.slug}`}
                  className="inline-flex rounded-sm border px-3 py-2 text-sm hover:border-gray-900"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )} */}

        <div className=" mt-6 md:mt-12">
          <h2 className="text-xl md:text-2xl mb-4">
            {locale === 'en' ? 'FAQ' : 'Поширені питання'}
          </h2>
          <div className="space-y-3">
            {(locale === 'en' ? [] : config.faqs).map((item) => (
              <details key={item.question} className="border rounded-sm p-3">
                <summary className="font-medium cursor-pointer">
                  {item.question}
                </summary>
                <p className="text-gray-700 mt-2">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}
    </>
  )
}
