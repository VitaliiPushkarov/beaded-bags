import ProductsContainer from '@/components/product/ProductsContainer'
import { getProductsLite } from '@/lib/db/products'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import {
  ACCESSORY_SUBCATEGORIES,
  getMainShopCategorySlugs,
  getShopCategoryConfig,
} from '@/lib/shop-taxonomy'

export const revalidate = 300

type ShopCategoryPageProps = {
  params: Promise<{ category: string }>
  searchParams: Promise<{
    q?: string
    color?: string
    subcategory?: string
  }>
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
}: ShopCategoryPageProps): Promise<Metadata> {
  const { category } = await params
  const config = getShopCategoryConfig(category)

  if (!config) {
    notFound()
  }

  if (config.redirectTo) {
    const target = getShopCategoryConfig(config.redirectTo)
    const targetPath = `/shop/${config.redirectTo}`
    return {
      title: target?.metaTitle ?? config.metaTitle,
      description: target?.metaDescription ?? config.metaDescription,
      alternates: {
        canonical: targetPath,
      },
      robots: {
        index: false,
        follow: true,
      },
    }
  }

  return {
    title: config.metaTitle,
    description: config.metaDescription,
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
  const config = getShopCategoryConfig(category)

  if (!config) {
    notFound()
  }

  if (config.redirectTo) {
    permanentRedirect(`/shop/${config.redirectTo}`)
  }

  const products = await getProductsLite({
    search: sp.q,
    color: sp.color,
    type: config.type,
    types: config.types,
    group: config.group,
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
          q: sp.q ?? '',
          color: sp.color ?? '',
          accessorySubcategory: sp.subcategory ?? '',
          bagTypes: lockedTypeForPage ?? '',
          group: config.group ?? '',
        }}
        lockedType={lockedTypeForPage}
        accessorySubcategoryOptions={accessorySubcategoryOptions}
        title={config.title}
      />

      <section className="max-w-[1440px] mx-auto px-5 md:px-[50px] pb-12 md:pb-16 md:pt-16 mt-12 md:mt-22">
        <div className=" mb-6">
          <h2 className="text-xl md:text-2xl mb-3">
            {config.metaTitle} від GERDAN
          </h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">
            {config.intro}
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
          <h2 className="text-xl md:text-2xl mb-4">Поширені питання</h2>
          <div className="space-y-3">
            {config.faqs.map((item) => (
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
