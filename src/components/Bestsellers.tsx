'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'

type ApiVariant = {
  id: string
  image: string | null
  priceUAH: number | null
  inStock: boolean
  color: string | null
}

type ApiProduct = {
  id: string
  slug: string
  name: string
  basePriceUAH: number | null
  priceUAH?: number | null
  images?: string[] | null
  mainImage?: string | null
  variants?: ApiVariant[]
}

type BestsellerProduct = {
  id: string
  slug: string
  name: string
  basePriceUAH: number | null
  priceUAH: number | null
  images: string[] | null
  mainImage: string | null
  variants?: ApiVariant[]
}

export default function Bestsellers() {
  const [products, setProducts] = useState<BestsellerProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch('/api/products?limit=12', { cache: 'no-store' })
        const raw: unknown = await res.json()
        const data: ApiProduct[] = Array.isArray(raw)
          ? (raw as ApiProduct[])
          : []

        const normalized: BestsellerProduct[] = data.map((p) => {
          const firstVariant = p.variants?.[0]
          return {
            id: p.id,
            slug: p.slug,
            name: p.name,
            basePriceUAH: p.basePriceUAH ?? null,
            // якщо немає ціни на продукті — беремо перший варіант
            priceUAH:
              (typeof p.priceUAH === 'number' ? p.priceUAH : null) ??
              (typeof p.basePriceUAH === 'number' ? p.basePriceUAH : null) ??
              (typeof firstVariant?.priceUAH === 'number'
                ? firstVariant.priceUAH
                : null) ??
              null,
            images: Array.isArray(p.images) ? p.images : [],
            mainImage: p.mainImage ?? null,
            variants: Array.isArray(p.variants) ? p.variants : [],
          }
        })

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
                const imageSrc =
                  p.mainImage ||
                  (p.images && p.images[0]) ||
                  (p.variants && p.variants[0]?.image) ||
                  placeholder

                const price =
                  (typeof p.priceUAH === 'number' ? p.priceUAH : null) ??
                  (typeof p.basePriceUAH === 'number'
                    ? p.basePriceUAH
                    : null) ??
                  (p.variants && typeof p.variants[0]?.priceUAH === 'number'
                    ? p.variants[0]!.priceUAH!
                    : 0)

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
                          {price.toLocaleString('uk-UA')} грн
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
