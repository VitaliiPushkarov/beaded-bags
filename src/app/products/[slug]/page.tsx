export const revalidate = 300

import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/ui/BreadCrumbs'
import { ProductClient } from './ProductClient'
import type { ProductType } from '@prisma/client'
import type { ProductWithVariants } from './productTypes'
import type { Metadata } from 'next'
import { calcDiscountedPrice } from '@/lib/pricing'
import { TYPE_LABELS } from '@/lib/labels'
import { resolveAvailabilityStatus, toSchemaOrgAvailability } from '@/lib/availability'
import { getProductBySlug, getProductMetaBySlug } from '@/lib/db/products'
import { getRequestLocale } from '@/lib/server-locale'

const SITE_URL = 'https://gerdan.online'

function getTypeToRoute(locale: 'uk' | 'en') {
  return {
    BAG: { label: locale === 'en' ? 'Bags' : 'Сумки', href: '/shop/sumky' },
    BELT_BAG: {
      label: locale === 'en' ? 'Belt Bags' : 'Бананки',
      href: '/shop/bananky',
    },
    BACKPACK: {
      label: locale === 'en' ? 'Backpacks' : 'Рюкзачки',
      href: '/shop/rjukzachky',
    },
    SHOPPER: {
      label: locale === 'en' ? 'Shoppers' : 'Шопери',
      href: '/shop/shopery',
    },
    CASE: { label: locale === 'en' ? 'Cases' : 'Чохли', href: '/shop/chohly' },
    ORNAMENTS: {
      label: locale === 'en' ? 'Accessories' : 'Аксесуари',
      href: '/shop/accessories',
    },
    ACCESSORY: {
      label: locale === 'en' ? 'Accessories' : 'Аксесуари',
      href: '/shop/accessories',
    },
  } satisfies Record<ProductType, { label: string; href: string }>
}

function toAbsoluteAssetUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return `${SITE_URL}${url}`
  return `${SITE_URL}/${url}`
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const locale = await getRequestLocale()
  const { slug } = await props.params

  const product = await getProductMetaBySlug(slug)

  if (!product) return {}

  const allImages = product.variants.flatMap((v) =>
    v.images.map((img) => img.url)
  )
  const mainImage =
    allImages[0] ||
    product.variants.find((v) => v.image)?.image ||
    '/img/placeholder.png'

  const title = product.name
  const description =
    product.description ??
    (locale === 'en'
      ? 'Handmade bag from the GERDAN collection.'
      : 'Сумка ручної роботи з колекції GERDAN. Український бренд аксесуарів.')

  return {
    title,
    description,
    alternates: {
      canonical: `/products/${product.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/products/${product.slug}`,
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
  const locale = await getRequestLocale()
  const { slug } = await params

  const p = await getProductBySlug(slug)

  if (!p) {
    return notFound()
  }

  const product = p as ProductWithVariants

  const TYPE_TO_ROUTE = getTypeToRoute(locale)

  const crumbs = [
    { label: locale === 'en' ? 'Home' : 'Головна', href: '/' },
    { label: locale === 'en' ? 'Catalog' : 'Каталог', href: '/shop' },
  ] as { label: string; href?: string }[]

  if (product.type && TYPE_TO_ROUTE[product.type]) {
    crumbs.push(TYPE_TO_ROUTE[product.type])
  }

  crumbs.push({ label: product.name || (locale === 'en' ? 'Product' : 'Товар') })

  const firstVariant = product.variants[0]

  // всі картинки з усіх варіантів
  const allImages = product.variants.flatMap((v) =>
    v.images.map((img) => img.url)
  )
  const mainImage =
    allImages[0] ||
    product.variants.find((v) => v.image)?.image ||
    '/img/placeholder.png'

  const fallbackAvailabilityStatus = resolveAvailabilityStatus({
    inStock: product.inStock || product.variants.some((v) => v.inStock),
  })

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
        availability: toSchemaOrgAvailability(
          variant
            ? resolveAvailabilityStatus({
                availabilityStatus: (variant as any).availabilityStatus,
                inStock: variant.inStock,
              })
            : fallbackAvailabilityStatus,
        ),
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
    category:
      product.type
        ? locale === 'en'
          ? TYPE_TO_ROUTE[product.type].label
          : TYPE_LABELS[product.type]
        : locale === 'en'
          ? 'Accessories'
          : 'Аксесуари',
    ...(colors.length ? { color: colors.join(', ') } : {}),
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Виготовлення',
        value: locale === 'en' ? 'Handmade' : 'Ручна робота',
      },
      {
        '@type': 'PropertyValue',
        name: locale === 'en' ? 'Brand country' : 'Країна бренду',
        value: locale === 'en' ? 'Ukraine' : 'Україна',
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
