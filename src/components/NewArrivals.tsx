import { unstable_cache } from 'next/cache'
import Image from 'next/image'
import Link from 'next/link'
import type { Product, ProductVariant } from '@prisma/client'
import {
  calcLocalizedDiscountedPrice,
  formatLocalizedMoney,
  pickLocalizedText,
} from '@/lib/localized-product'
import { getRequestLocale } from '@/lib/server-locale'
import { prisma } from '@/lib/prisma'
import {
  isPrismaAvailabilityError,
  withPrismaRetry,
} from '@/lib/prisma-resilience'

type NewArrivalsVariant = ProductVariant & {
  images: { url: string; hover: boolean; sort: number }[]
  product: Pick<
    Product,
    | 'id'
    | 'slug'
    | 'name'
    | 'nameEn'
    | 'type'
    | 'basePriceUAH'
    | 'basePriceUSD'
    | 'offerNote'
    | 'offerNoteEn'
  >
}

const NEW_ARRIVALS_VISIBLE_COUNT = 12

async function queryNewArrivals(): Promise<NewArrivalsVariant[]> {
  try {
    return await withPrismaRetry(
      () =>
        prisma.productVariant.findMany({
          where: {
            showInNewArrivals: true,
            product: {
              status: 'PUBLISHED',
            },
          },
          orderBy: [
            { sortNewArrivals: 'asc' },
            { product: { createdAt: 'desc' } },
          ],
          take: NEW_ARRIVALS_VISIBLE_COUNT,
          include: {
            images: {
              orderBy: { sort: 'asc' },
              select: { url: true, hover: true, sort: true },
            },
            product: {
              select: {
                id: true,
                slug: true,
                name: true,
                nameEn: true,
                type: true,
                basePriceUAH: true,
                basePriceUSD: true,
                offerNote: true,
                offerNoteEn: true,
              },
            },
          },
        }),
      { scope: 'newArrivals.productVariant.findMany' },
    )
  } catch (error) {
    if (isPrismaAvailabilityError(error)) {
      console.error(
        '[db] Failed to load new arrivals, using empty list.',
        error,
      )
      return []
    }
    throw error
  }
}

// Catalog data changes rarely and the shop pages already tolerate 300s
// staleness (revalidate = 300), so cache the query to keep it off the
// home page's critical render path (it previously ran on every request).
const getNewArrivals = unstable_cache(queryNewArrivals, ['home-new-arrivals'], {
  tags: ['new-arrivals'],
  revalidate: 300,
})

export default async function NewArrivals() {
  const locale = await getRequestLocale()
  const numberLocale = locale === 'en' ? 'en-US' : 'uk-UA'
  const variants = await getNewArrivals()

  const placeholder = '/img/placeholder.png'

  return (
    <section className="mx-auto py-12">
      <div className="max-w-full px-6">
        <h2 className="text-2xl font-semibold mb-5 uppercase">
          {locale === 'en' ? 'New arrivals' : 'Новинки'}
        </h2>

        <div className="relative flex flex-col gap-2">
          <div className="flex items-stretch gap-5 overflow-x-auto scrollbar-always snap-x pb-6 [scrollbar-gutter:stable]">
            {variants.length === 0 ? (
              <div className="text-gray-500 text-sm">
                {locale === 'en'
                  ? 'No products yet.'
                  : 'Поки що немає товарів.'}
              </div>
            ) : (
              variants.map((variant) => {
                const p = variant.product
                const productName = pickLocalizedText(
                  p.name,
                  (p as any).nameEn,
                  locale,
                )
                const variantImages = (variant.images || [])
                  .slice()
                  .sort((a, b) => (a.sort || 0) - (b.sort || 0))

                const primaryImage =
                  variantImages[0]?.url || variant.image || placeholder

                const hoverImage =
                  variantImages.find((img) => img.hover)?.url ||
                  variantImages[1]?.url ||
                  primaryImage

                const {
                  basePrice,
                  finalPrice,
                  hasDiscount,
                  discountPercent,
                  currency,
                } = calcLocalizedDiscountedPrice({
                  locale,
                  priceUAH:
                    (typeof variant.priceUAH === 'number'
                      ? variant.priceUAH
                      : null) ??
                    (typeof p.basePriceUAH === 'number'
                      ? p.basePriceUAH
                      : null) ??
                    0,
                  priceUSD:
                    (typeof (variant as any)?.priceUSD === 'number'
                      ? (variant as any).priceUSD
                      : null) ??
                    (typeof (p as any).basePriceUSD === 'number'
                      ? (p as any).basePriceUSD
                      : null) ??
                    null,
                  discountPercent: variant.discountPercent,
                  discountUAH: variant.discountUAH ?? 0,
                })
                const finalPriceLabel = formatLocalizedMoney(
                  finalPrice,
                  currency,
                  numberLocale,
                )
                const basePriceLabel = formatLocalizedMoney(
                  basePrice,
                  currency,
                  numberLocale,
                )

                const productHref = `/products/${p.slug}?variant=${variant.id}`

                return (
                  <div
                    key={variant.id}
                    className="w-[260px] shrink-0 snap-start 2xl:w-[320px] 2xl:min-h-[480px]"
                  >
                    <Link
                      href={productHref}
                      className="flex h-full w-full flex-col"
                    >
                      <div className="group relative aspect-3/4 bg-gray-100 overflow-hidden border 2xl:aspect-auto 2xl:flex-1">
                        <Image
                          src={primaryImage}
                          alt={productName}
                          fill
                          sizes="(min-width: 1536px) 560px, (max-width: 768px) 60vw, 260px"
                          className="object-cover transition-opacity duration-300 group-hover:opacity-0 group-hover:scale-[1.02]"
                        />
                        <Image
                          src={hoverImage}
                          alt={`${productName} hover`}
                          fill
                          sizes="(min-width: 1536px) 560px, (max-width: 768px) 60vw, 260px"
                          className="object-cover transition-opacity duration-300 opacity-0 group-hover:opacity-100 group-hover:scale-[1.02]"
                        />
                      </div>
                      <div className="mt-3 flex flex-col gap-1.5 min-w-0">
                        <div className="text-[16px] leading-snug line-clamp-2 break-words">
                          {productName}
                        </div>
                        <div className="text-sm md:text-lg text-gray-700 whitespace-nowrap flex items-baseline gap-2">
                          <span>{finalPriceLabel}</span>
                          {hasDiscount && (
                            <>
                              <span className="text-xs text-gray-500 line-through">
                                {basePriceLabel}
                              </span>
                              <span className="text-[10px] text-white md:text-xs border rounded-full px-2 py-0.5 self-center bg-[#DE2222]">
                                -{discountPercent}%
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  </div>
                )
              })
            )}
          </div>
          <div className="self-end">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center mt-4 underline hover:no-underline"
            >
              {locale === 'en' ? 'All products' : 'Всі товари'}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
