import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/ui/BreadCrumbs'
import { ProductClient } from './ProductClient'
import type { Product, ProductVariant, ProductType } from '@prisma/client'
import type { Metadata } from 'next'

type ProductWithVariants = Product & {
  variants: ProductVariant[]
}

const TYPE_TO_ROUTE: Record<ProductType, { label: string; href: string }> = {
  BAG: { label: 'Сумки', href: '/shop/sumky' },
  BELT_BAG: { label: 'Бананки', href: '/shop/bananky' },
  BACKPACK: { label: 'Рюкзачки', href: '/shop/rjukzachky' },
  SHOPPER: { label: 'Шопери', href: '/shop/shopery' },
  CASE: { label: 'Чохли', href: '/shop/chohly' },
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await props.params

  const product = await prisma.product.findUnique({
    where: { slug },
    include: { variants: true },
  })

  if (!product) return {}

  const p = product as ProductWithVariants

  const ogImage =
    p.variants.find((v) => v.image)?.image ?? '/img/placeholder.png'

  const title = `${p.name} — GERDAN`
  const description =
    p.description ??
    'Сумка ручної роботи з колекції GERDAN. Український бренд аксесуарів.'

  return {
    title,
    description,
    alternates: {
      canonical: `/products/${p.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `https://gerdan.online/products/${p.slug}`,
      type: 'website',
      images: [{ url: ogImage }],
    },
    other: {
      'og:type': 'product',
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const p = await prisma.product.findUnique({
    where: { slug: slug },
    include: {
      variants: {
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!p) {
    return notFound()
  }
  const product = p as ProductWithVariants

  const crumbs = [
    { label: 'Головна', href: '/' },
    { label: 'Каталог', href: '/shop' },
  ] as { label: string; href?: string }[]

  if (p.type && TYPE_TO_ROUTE[p.type]) {
    crumbs.push(TYPE_TO_ROUTE[p.type])
  }

  crumbs.push({ label: p.name || 'Товар' })
  const firstVariant = product.variants[0]
  const image =
    product.variants.find((v) => v.image)?.image ?? '/img/placeholder.png'
  const price = firstVariant?.priceUAH ?? product.basePriceUAH ?? 0

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: [`https://gerdan.online${image}`],
    description:
      product.description ??
      'Сумка ручної роботи з колекції GERDAN. Український бренд аксесуарів.',
    sku: firstVariant?.sku ?? undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'UAH',
      price: price,
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `https://gerdan.online/products/${product.slug}`,
    },
    brand: {
      '@type': 'Brand',
      name: 'GERDAN',
    },
  }
  return (
    <div className="max-w-[1440px] mx-auto py-10 px-[50px]">
      {/* JSON-LD для Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense fallback={null}>
        <Breadcrumbs override={crumbs} />
      </Suspense>
      <ProductClient p={p as ProductWithVariants} />
    </div>
  )
}
