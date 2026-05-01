import ProductsContainer from '@/components/product/ProductsContainer'
import { getProductsLite } from '@/lib/db/products'
import type { Metadata } from 'next'
import { getRequestLocale } from '@/lib/server-locale'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  return {
    title: locale === 'en' ? 'Sale | GERDAN' : 'Sale | GERDAN',
    description:
      locale === 'en'
        ? 'Discounted handmade bags and accessories by GERDAN.'
        : 'Товари зі знижками від GERDAN: сумки ручної роботи та аксесуари.',
    alternates: {
      canonical: '/sale',
    },
  }
}

export default async function SalePage() {
  const locale = await getRequestLocale()
  const products = await getProductsLite({
    onSale: true,
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
      <ProductsContainer
        initialProducts={products}
        title={locale === 'en' ? 'Sale' : 'Sale'}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  )
}
