import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/ui/BreadCrumbs'
import { ProductClient } from './ProductClient'
import type {
  Product,
  ProductVariant,
  ProductType,
  ProductVariantImage,
} from '@prisma/client'
import type { Metadata } from 'next'

type VariantWithImages = ProductVariant & {
  images: ProductVariantImage[]
}

type ProductWithVariants = Product & {
  variants: VariantWithImages[]
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
    include: {
      variants: {
        include: {
          images: {
            orderBy: { sort: 'asc' },
          },
        },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!product) return {}

  const p = product as ProductWithVariants

  const allImages = product.variants.flatMap((v) =>
    v.images.map((img) => img.url)
  )
  const mainImage =
    allImages[0] ||
    product.variants.find((v) => v.image)?.image ||
    '/img/placeholder.png'

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
      images: [{ url: mainImage }],
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
    where: { slug },
    include: {
      variants: {
        include: {
          images: {
            orderBy: { sort: 'asc' },
          },
        },
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

  if (product.type && TYPE_TO_ROUTE[product.type]) {
    crumbs.push(TYPE_TO_ROUTE[product.type])
  }

  crumbs.push({ label: product.name || 'Товар' })

  const firstVariant = product.variants[0]

  // всі картинки з усіх варіантів
  const allImages = product.variants.flatMap((v) =>
    v.images.map((img) => img.url)
  )
  const mainImage =
    allImages[0] ||
    product.variants.find((v) => v.image)?.image ||
    '/img/placeholder.png'

  const price = firstVariant?.priceUAH ?? product.basePriceUAH ?? 0
  const inStock = product.inStock || product.variants.some((v) => v.inStock)

  const m = 6
  const now = new Date()
  const priceValidUntil = new Date(
    now.getFullYear(),
    now.getMonth() + m,
    now.getDate()
  )
    .toISOString()
    .split('T')[0]

  const productLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: allImages.length ? allImages : [mainImage],
    sku: firstVariant?.id ?? product.id,
    brand: {
      '@type': 'Brand',
      name: 'GERDAN',
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'UAH',
      price,
      priceValidUntil,
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `https://gerdan.online/products/${product.slug}`,
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: '0',
          currency: 'UAH',
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'UA',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 2,
            unitCode: 'd',
          },
          transitTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 3,
            unitCode: 'd',
          },
        },
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'UA',
        returnPolicyCategory:
          'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 14,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
    },
  }

  return (
    <div className="max-w-[1440px] mx-auto py-10 px-5 md:px-[50px]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />
      <Suspense fallback={null}>
        <Breadcrumbs override={crumbs} />
      </Suspense>
      <ProductClient p={product} />
    </div>
  )
}
