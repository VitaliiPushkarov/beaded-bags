import ProductsContainer from '@/components/product/ProductsContainer'
import { getProductsLite } from '@/lib/db/products'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ACCESSORY_SUBCATEGORIES,
  getAccessorySubcategoryConfig,
  getAccessorySubcategorySlugs,
  matchAccessorySubcategory,
} from '@/lib/shop-taxonomy'
import {
  hasFacetedQueryParams,
  pickFirstQueryValue,
  type QueryParamValue,
} from '@/lib/seo/faceted'
import { getRequestLocale } from '@/lib/server-locale'

export const revalidate = 300

function accessorySubcategoryTitle(slug: string, fallback: string, locale: 'uk' | 'en') {
  if (locale !== 'en') return fallback
  const map: Record<string, string> = {
    breloky: 'Keychains',
    gerdany: 'Gerdans',
    sylyanky: 'Sylyanky',
    mitenky: 'Mittens',
    shapky: 'Beanies',
    sharfy: 'Scarves',
    rezynky: 'Hair Ties',
    chepchyky: 'Bonnets',
    'navushnyky-viazani': 'Knitted Headphones',
  }
  return map[slug] || fallback
}

function isTruthyQueryParam(value?: string | null): boolean {
  return value === '1' || value === 'true'
}

type AccessorySubcategoryPageProps = {
  params: Promise<{ subcategory: string }>
  searchParams: Promise<
    Record<string, QueryParamValue> & {
      q?: QueryParamValue
      color?: QueryParamValue
      inStock?: QueryParamValue
      onSale?: QueryParamValue
      min?: QueryParamValue
      max?: QueryParamValue
      sortBase?: QueryParamValue
      sortPrice?: QueryParamValue
      subcategory?: QueryParamValue
      type?: QueryParamValue
      group?: QueryParamValue
    }
  >
}

export function generateStaticParams() {
  return getAccessorySubcategorySlugs().map((subcategory) => ({ subcategory }))
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
}: AccessorySubcategoryPageProps): Promise<Metadata> {
  const locale = await getRequestLocale()
  const { subcategory } = await params
  const sp = await searchParams
  const config = getAccessorySubcategoryConfig(subcategory)

  if (!config) {
    notFound()
  }

  const shouldNoindex = hasFacetedQueryParams(sp)

  return {
    title:
      locale === 'en'
        ? `${accessorySubcategoryTitle(subcategory, config.label, locale)} | GERDAN`
        : config.metaTitle,
    description:
      locale === 'en'
        ? `Browse ${accessorySubcategoryTitle(subcategory, config.label, locale)} by GERDAN.`
        : config.metaDescription,
    alternates: {
      canonical: `/shop/accessories/${subcategory}`,
    },
    robots: shouldNoindex
      ? {
          index: false,
          follow: true,
        }
      : undefined,
  }
}

export default async function AccessorySubcategoryPage({
  params,
  searchParams,
}: AccessorySubcategoryPageProps) {
  const locale = await getRequestLocale()
  const { subcategory } = await params
  const sp = await searchParams
  const config = getAccessorySubcategoryConfig(subcategory)

  if (!config) {
    notFound()
  }

  const rawProducts = await getProductsLite({
    search: pickFirstQueryValue(sp.q),
    color: pickFirstQueryValue(sp.color),
    types: ['ACCESSORY'],
    onSale: isTruthyQueryParam(pickFirstQueryValue(sp.onSale)),
  })
  const products = rawProducts.filter((item) =>
    matchAccessorySubcategory(item, subcategory),
  )

  const itemListLd = buildItemListJsonLd(
    products.map((item) => item.slug),
    accessorySubcategoryTitle(subcategory, config.label, locale),
  )
  const faqLd = buildFaqJsonLd(config.faqs)
  const siblingSubcategories = ACCESSORY_SUBCATEGORIES.filter(
    (item) => item.slug !== subcategory,
  )

  return (
    <>
      <ProductsContainer
        initialProducts={products}
        initialFilters={{
          q: pickFirstQueryValue(sp.q) ?? '',
          color: pickFirstQueryValue(sp.color) ?? '',
          onSale: isTruthyQueryParam(pickFirstQueryValue(sp.onSale)),
        }}
        hideTypeFilter
        title={accessorySubcategoryTitle(subcategory, config.label, locale)}
      />

      <section className="max-w-[1440px] mx-auto px-5 md:px-[50px] pb-12 md:pb-16 md:pt-16 mt-12 md:mt-22">
        <div className="  mb-6">
          <h2 className="text-xl md:text-2xl mb-3">
            {locale === 'en'
              ? `${accessorySubcategoryTitle(subcategory, config.label, locale)} by GERDAN`
              : `${config.metaTitle} від GERDAN`}
          </h2>
          <p className="text-gray-700 leading-relaxed">
            {locale === 'en'
              ? 'Detailed category description in English is being prepared.'
              : config.intro}
          </p>
        </div>

        {/* <div className="border rounded-md p-5 md:p-7 mb-6">
          <h2 className="text-xl md:text-2xl mb-3">
            Інші підкатегорії аксесуарів
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/shop/accessories"
              className="inline-flex rounded-sm border px-3 py-2 text-sm hover:border-gray-900"
            >
              Усі аксесуари
            </Link>
            {siblingSubcategories.map((item) => (
              <Link
                key={item.slug}
                href={`/shop/accessories/${item.slug}`}
                className="inline-flex rounded-sm border px-3 py-2 text-sm hover:border-gray-900"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div> */}

        <div className=" mt-6 md:mt-12 ">
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
