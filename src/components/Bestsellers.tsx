import Image from 'next/image'
import Link from 'next/link'
import type { Product, ProductVariant } from '@prisma/client'
import { calcDiscountedPrice } from '@/lib/pricing'
import { matchAccessorySubcategory } from '@/lib/shop-taxonomy'
import { getRequestLocale } from '@/lib/server-locale'

type ProductWithVariants = Product & {
  variants: (ProductVariant & {
    images?: { url: string; hover?: boolean; sort?: number }[]
  })[]
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gerdan.online'
const BESTSELLERS_VISIBLE_COUNT = 12
const BESTSELLERS_SOURCE_RANGE = 60

async function getBestsellers(): Promise<ProductWithVariants[]> {
  const res = await fetch(
    `${BASE_URL}/api/products?lite=1&limit=${BESTSELLERS_SOURCE_RANGE}`,
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
    .slice(0, BESTSELLERS_VISIBLE_COUNT)
}

export default async function Bestsellers() {
  const locale = await getRequestLocale()
  const products = await getBestsellers()

  const placeholder = '/img/placeholder.png'

  return (
    <section className="mx-auto py-12">
      <div className="max-w-full px-6">
        <h2 className="text-2xl font-semibold mb-5 uppercase">
          {locale === 'en' ? 'New arrivals' : 'Новинки'}
        </h2>

        <div className="relative flex flex-col gap-2">
          <div className="flex gap-5 overflow-x-auto scrollbar-always snap-x pb-2">
            {products.length === 0 ? (
              <div className="text-gray-500 text-sm">
                {locale === 'en' ? 'No products yet.' : 'Поки що немає товарів.'}
              </div>
            ) : (
              products.map((p) => {
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
                  basePriceUAH,
                  finalPriceUAH,
                  hasDiscount,
                  discountPercent,
                } = calcDiscountedPrice({
                  basePriceUAH:
                    (typeof firstVariant?.priceUAH === 'number'
                      ? firstVariant.priceUAH
                      : null) ??
                    (typeof p.basePriceUAH === 'number'
                      ? p.basePriceUAH
                      : null) ??
                    0,
                  discountPercent: firstVariant?.discountPercent,
                  discountUAH: firstVariant?.discountUAH ?? 0,
                })

                return (
                  <div
                    key={p.id}
                    className="min-w-[260px] snap-start 2xl:w-[560px] 2xl:min-h-[680px]"
                  >
                    <Link href={`/products/${p.slug}`}>
                      <div className="group relative aspect-3/4 bg-gray-100 overflow-hidden border">
                        <Image
                          src={primaryImage}
                          alt={p.name}
                          fill
                          sizes="(max-width: 768px) 60vw, 260px"
                          className="object-cover transition-opacity duration-300 group-hover:opacity-0 group-hover:scale-[1.02]"
                        />
                        <Image
                          src={hoverImage}
                          alt={`${p.name} hover`}
                          fill
                          sizes="(max-width: 768px) 60vw, 260px"
                          className="object-cover transition-opacity duration-300 opacity-0 group-hover:opacity-100 group-hover:scale-[1.02]"
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-4">
                        <div className="text-sm truncate">{p.name}</div>
                        <div className="text-sm text-gray-700 whitespace-nowrap flex items-baseline gap-2">
                          <span>
                            {finalPriceUAH.toLocaleString(
                              locale === 'en' ? 'en-US' : 'uk-UA',
                            )}{' '}
                            ₴
                          </span>
                          {hasDiscount && (
                            <>
                              <span className="text-xs text-gray-500 line-through">
                                {basePriceUAH.toLocaleString(
                                  locale === 'en' ? 'en-US' : 'uk-UA',
                                )}{' '}
                                ₴
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
