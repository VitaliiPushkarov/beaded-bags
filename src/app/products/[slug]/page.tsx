export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/ui/BreadCrumbs'
import { ProductClient } from './ProductClient'
import type { ProductType } from '@prisma/client'
import type { ProductWithVariants } from './productTypes'
import type { Metadata } from 'next'
import { calcDiscountedPrice } from '@/lib/pricing'
import { TYPE_LABELS } from '@/lib/labels'

const SITE_URL = 'https://gerdan.online'

const TYPE_TO_ROUTE: Record<ProductType, { label: string; href: string }> = {
  BAG: { label: 'Сумки', href: '/shop/sumky' },
  BELT_BAG: { label: 'Бананки', href: '/shop/bananky' },
  BACKPACK: { label: 'Рюкзачки', href: '/shop/rjukzachky' },
  SHOPPER: { label: 'Шопери', href: '/shop/shopery' },
  CASE: { label: 'Чохли', href: '/shop/chohly' },
  ORNAMENTS: { label: 'Прикраси', href: '/shop/prykrasy' },
  ACCESSORY: { label: 'Аксесуари', href: '/shop/accessories' },
}

function toAbsoluteAssetUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return `${SITE_URL}${url}`
  return `${SITE_URL}/${url}`
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
          straps: {
            include: {
              images: {
                orderBy: { sort: 'asc' },
              },
            },
          },
          addonsOnVariant: {
            orderBy: { sort: 'asc' },
            include: {
              addonVariant: {
                include: {
                  product: true,
                  images: true,
                },
              },
            },
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
      url: `${SITE_URL}/products/${p.slug}`,
      type: 'website',
      images: [{ url: toAbsoluteAssetUrl(mainImage) }],
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
          straps: {
            include: {
              images: {
                orderBy: { sort: 'asc' },
              },
            },
          },
          addonsOnVariant: {
            orderBy: { sort: 'asc' },
            include: {
              addonVariant: {
                include: {
                  product: true,
                  images: true,
                },
              },
            },
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

  const productUrl = `${SITE_URL}/products/${product.slug}`
  const imageUrls = (allImages.length ? allImages : [mainImage]).map((img) =>
    toAbsoluteAssetUrl(img),
  )
  const colors = Array.from(
    new Set(
      product.variants
        .map((v) => v.color)
        .filter((c): c is string => typeof c === 'string' && c.length > 0),
    ),
  )

  const shippingDetails = {
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
  }

  const returnPolicy = {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'UA',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 14,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/FreeReturn',
  }

  const variantOffers = (product.variants.length ? product.variants : [null]).map(
    (variant) => {
      const { finalPriceUAH } = calcDiscountedPrice({
        basePriceUAH:
          variant?.priceUAH ?? firstVariant?.priceUAH ?? product.basePriceUAH ?? 0,
        discountPercent: variant?.discountPercent ?? firstVariant?.discountPercent,
        discountUAH: variant?.discountUAH ?? firstVariant?.discountUAH,
      })

      return {
        '@type': 'Offer',
        sku: variant?.id ?? firstVariant?.id ?? product.id,
        priceCurrency: 'UAH',
        price: finalPriceUAH,
        priceValidUntil,
        availability:
          (variant?.inStock ?? inStock)
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        url: productUrl,
        seller: {
          '@type': 'Organization',
          name: 'GERDAN',
          url: SITE_URL,
        },
        shippingDetails,
        hasMerchantReturnPolicy: returnPolicy,
        ...(variant?.color ? { color: variant.color } : {}),
      }
    },
  )

  const prices = variantOffers.map((offer) => Number(offer.price))
  const aggregateOffer =
    variantOffers.length > 1
      ? {
          '@type': 'AggregateOffer',
          priceCurrency: 'UAH',
          lowPrice: Math.min(...prices),
          highPrice: Math.max(...prices),
          offerCount: variantOffers.length,
          offers: variantOffers,
        }
      : variantOffers[0]

  const productLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: imageUrls,
    sku: firstVariant?.id ?? product.id,
    mpn: firstVariant?.id ?? product.id,
    url: productUrl,
    category: product.type ? TYPE_LABELS[product.type] : 'Аксесуари',
    ...(colors.length ? { color: colors.join(', ') } : {}),
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Виготовлення',
        value: 'Ручна робота',
      },
      {
        '@type': 'PropertyValue',
        name: 'Країна бренду',
        value: 'Україна',
      },
    ],
    brand: {
      '@type': 'Brand',
      name: 'GERDAN',
    },
    offers: aggregateOffer,
  }

  return (
    <div className="max-w-[1440px] mx-auto py-6 px-5 md:px-[50px]">
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
