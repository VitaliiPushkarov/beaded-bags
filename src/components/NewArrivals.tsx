import Image from 'next/image'
import Link from 'next/link'
import type { Product, ProductVariant } from '@prisma/client'
import {
  calcLocalizedDiscountedPrice,
  formatLocalizedMoney,
  pickLocalizedText,
} from '@/lib/localized-product'
import { matchAccessorySubcategory } from '@/lib/shop-taxonomy'
import { getRequestLocale } from '@/lib/server-locale'

type ProductWithVariants = Product & {
  variants: (ProductVariant & {
    images?: { url: string; hover?: boolean; sort?: number }[]
  })[]
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gerdan.online'
const NEW_ARRIVALS_VISIBLE_COUNT = 12
const NEW_ARRIVALS_SOURCE_RANGE = 60

async function getNewArrivals(): Promise<ProductWithVariants[]> {
  const res = await fetch(
    `${BASE_URL}/api/products?lite=1&newArrivals=1&limit=${NEW_ARRIVALS_SOURCE_RANGE}`,
    {
      cache: 'no-store',
    },
  )
  if (!res.ok) return []
  const json = (await res.json()) as
    | ProductWithVariants[]
    | { items?: ProductWithVariants[] }
  const items = Array.isArray(json) ? json : (json.items ?? [])

  return items
    .filter((item) => {
      const isAccessoryType =
        item.type === 'ACCESSORY' || item.type === 'ORNAMENTS'

      if (!isAccessoryType) return true

      return !matchAccessorySubcategory(item, 'breloky')
    })
    .slice(0, NEW_ARRIVALS_VISIBLE_COUNT)
}

export default async function NewArrivals() {
  const locale = await getRequestLocale()
  const numberLocale = locale === 'en' ? 'en-US' : 'uk-UA'
  const products = await getNewArrivals()

  const placeholder = '/img/placeholder.png'

  return (
    <section className="mx-auto py-12">
      <div className="max-w-full px-6">
        <h2 className="text-2xl font-semibold mb-5 uppercase">
          {locale === 'en' ? 'New arrivals' : 'Новинки'}
        </h2>

        <div className="relative flex flex-col gap-2">
          <div className="flex items-stretch gap-5 overflow-x-auto scrollbar-always snap-x pb-2">
            {products.length === 0 ? (
              <div className="text-gray-500 text-sm">
                {locale === 'en' ? 'No products yet.' : 'Поки що немає товарів.'}
              </div>
            ) : (
              products.map((p) => {
                const productName = pickLocalizedText(
                  p.name,
                  (p as any).nameEn,
                  locale,
                )
                const firstVariant =
                  p.variants
                    .filter(
                      (v) =>
                        typeof v.sortBestsellers === 'number' &&
                        v.sortBestsellers > 0,
                    )
                    .sort(
                      (a, b) =>
                        (a.sortBestsellers ?? 9999) -
                        (b.sortBestsellers ?? 9999),
                    )[0] || p.variants[0]

                const variantImages = (firstVariant?.images || [])
                  .slice()
                  .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))

                const primaryImage =
                  variantImages[0]?.url || firstVariant?.image || placeholder

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
                    (typeof firstVariant?.priceUAH === 'number'
                      ? firstVariant.priceUAH
                      : null) ??
                    (typeof p.basePriceUAH === 'number'
                      ? p.basePriceUAH
                      : null) ??
                    0,
                  priceUSD:
                    (typeof (firstVariant as any)?.priceUSD === 'number'
                      ? (firstVariant as any).priceUSD
                      : null) ??
                    (typeof (p as any).basePriceUSD === 'number'
                      ? (p as any).basePriceUSD
                      : null) ??
                    null,
                  discountPercent: firstVariant?.discountPercent,
                  discountUAH: firstVariant?.discountUAH ?? 0,
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

                return (
                  <div
                    key={p.id}
                    className="w-[260px] shrink-0 snap-start 2xl:w-[560px] 2xl:min-h-[680px]"
                  >
                    <Link
                      href={`/products/${p.slug}`}
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
                      <div className="mt-3 flex items-center justify-between gap-4">
                        <div className="text-sm truncate">{productName}</div>
                        <div className="text-sm text-gray-700 whitespace-nowrap flex items-baseline gap-2">
                          <span>{finalPriceLabel}</span>
                          {hasDiscount && (
                            <>
                              <span className="text-xs text-gray-500 line-through">
                                {basePriceLabel}
                              </span>
                              <span className="text-[10px] text-white md:text-xs border  rounded-full px-2 py-0.5 self-center bg-[#DE2222]">
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
