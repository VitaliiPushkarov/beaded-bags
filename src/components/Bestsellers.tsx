'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'

type BestsellerProduct = {
  id: string
  slug: string
  name: string
  basePriceUAH: number | null
  priceUAH: number | null
  images: string[] | null
  mainImage: string | null
}

export default function Bestsellers() {
  const [products, setProducts] = useState<BestsellerProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch('/api/products?limit=12', {
          // щоб кеш не віддавав порожні картинки
          cache: 'no-store',
        })
        const data = await res.json()

        // нормалізуємо під наш тип
        const normalized: BestsellerProduct[] = (
          Array.isArray(data) ? data : []
        ).map((p: any) => ({
          id: p.id ?? p.productId ?? crypto.randomUUID(),
          slug: p.slug,
          name: p.name,
          basePriceUAH: p.basePriceUAH ?? null,
          priceUAH: p.priceUAH ?? null,
          images: Array.isArray(p.images)
            ? p.images
            : p.mainImage
            ? [p.mainImage]
            : [],
          mainImage: p.mainImage ?? null,
        }))

        setProducts(normalized)
      } catch (err) {
        console.error('❌ Failed to load products:', err)
      } finally {
        setLoading(false)
      }
    }
    loadProducts()
  }, [])

  const placeholder = '/img/placeholder.png'

  return (
    <section className="mx-auto py-12">
      <div className="max-w-full px-6">
        <h2 className="text-2xl font-semibold mb-5">БЕСТСЕЛЕРИ</h2>

        <div className="relative">
          <div className="flex gap-5 overflow-x-auto scrollbar-always snap-x pb-2">
            {loading ? (
              // скелетон
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="min-w-[260px] snap-start">
                  <div className="relative aspect-[3/4] bg-gray-100 animate-pulse rounded" />
                  <div className="mt-3 h-4 bg-gray-100 rounded w-3/4 animate-pulse" />
                </div>
              ))
            ) : products.length === 0 ? (
              <div className="text-gray-500 text-sm">
                Поки що немає бестселерів.
              </div>
            ) : (
              products.map((p) => {
                // обираємо перше валідне зображення
                const imageSrc =
                  (p.images && p.images[0]) || p.mainImage || placeholder

                return (
                  <div key={p.id} className="min-w-[260px] snap-start">
                    <Link href={`/products/${p.slug}`}>
                      <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden border rounded">
                        <Image
                          src={imageSrc}
                          alt={p.name}
                          fill
                          sizes="(max-width: 768px) 60vw, 260px"
                          className="object-cover"
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-4">
                        <div className="text-sm truncate">{p.name}</div>
                        <div className="text-sm text-gray-700 whitespace-nowrap">
                          {(p.priceUAH ?? p.basePriceUAH ?? 0).toLocaleString(
                            'uk-UA'
                          )}{' '}
                          грн
                        </div>
                      </div>
                    </Link>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
