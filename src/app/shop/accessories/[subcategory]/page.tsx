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

export const revalidate = 300

type AccessorySubcategoryPageProps = {
  params: Promise<{ subcategory: string }>
  searchParams: Promise<{
    q?: string
    color?: string
  }>
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
}: AccessorySubcategoryPageProps): Promise<Metadata> {
  const { subcategory } = await params
  const config = getAccessorySubcategoryConfig(subcategory)

  if (!config) {
    notFound()
  }

  return {
    title: config.metaTitle,
    description: config.metaDescription,
    alternates: {
      canonical: `/shop/accessories/${subcategory}`,
    },
  }
}

export default async function AccessorySubcategoryPage({
  params,
  searchParams,
}: AccessorySubcategoryPageProps) {
  const { subcategory } = await params
  const sp = await searchParams
  const config = getAccessorySubcategoryConfig(subcategory)

  if (!config) {
    notFound()
  }

  const rawProducts = await getProductsLite({
    search: sp.q,
    color: sp.color,
    types: ['ACCESSORY'],
  })
  const products = rawProducts.filter((item) =>
    matchAccessorySubcategory(item, subcategory),
  )

  const itemListLd = buildItemListJsonLd(
    products.map((item) => item.slug),
    config.label,
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
          q: sp.q ?? '',
          color: sp.color ?? '',
        }}
        hideTypeFilter
        title={config.label}
      />

      <section className="max-w-[1440px] mx-auto px-5 md:px-[50px] pb-12 md:pb-16 md:pt-16 mt-12 md:mt-22">
        <div className="  mb-6">
          <h2 className="text-xl md:text-2xl mb-3">
            {config.metaTitle} від GERDAN
          </h2>
          <p className="text-gray-700 leading-relaxed">{config.intro}</p>
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
