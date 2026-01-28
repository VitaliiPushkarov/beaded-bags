import Image from 'next/image'
import Link from 'next/link'
import type { Product, ProductVariant } from '@prisma/client'

type ProductWithVariants = Product & {
  variants: (ProductVariant & {
    images?: { url: string; hover?: boolean; sort?: number }[]
  })[]
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gerdan.online'

async function getBestsellers(): Promise<ProductWithVariants[]> {
  const res = await fetch(`${BASE_URL}/api/products?limit=12`, {
    next: { revalidate: 300 },
  })
  if (!res.ok) return []
  return (await res.json()) as ProductWithVariants[]
}

export default async function Bestsellers() {
  const products = await getBestsellers()

  const placeholder = '/img/placeholder.png'

  return (
    <section className="mx-auto py-12">
      <div className="max-w-full px-6">
        <h2 className="text-2xl font-semibold mb-5 uppercase">Новинки</h2>

        <div className="relative flex flex-col gap-2">
          <div className="flex gap-5 overflow-x-auto scrollbar-always snap-x pb-2">
            {products.length === 0 ? (
              <div className="text-gray-500 text-sm">
                Поки що немає бестселерів.
              </div>
            ) : (
              products.map((p) => {
                const firstVariant =
                  p.variants
                    .filter(
                      (v) =>
                        typeof v.sortBestsellers === 'number' &&
                        v.sortBestsellers > 0
                    )
                    .sort(
                      (a, b) =>
                        (a.sortBestsellers ?? 9999) -
                        (b.sortBestsellers ?? 9999)
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

                const price =
                  (typeof firstVariant?.priceUAH === 'number'
                    ? firstVariant.priceUAH
                    : null) ??
                  (typeof p.basePriceUAH === 'number'
                    ? p.basePriceUAH
                    : null) ??
                  0

                return (
                  <div
                    key={p.id}
                    className="min-w-[260px] snap-start 2xl:w-[560px] 2xl:min-h-[680px]"
                  >
                    <Link href={`/products/${p.slug}`}>
                      <div
                        className="group relative aspect-3/4 bg-gray-100 overflow-hidden border"
                      >
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
                        <div className="text-sm text-gray-700 whitespace-nowrap">
                          {price.toLocaleString('uk-UA')} ₴
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
              Всі товари
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
