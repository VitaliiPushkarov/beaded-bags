'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import type { Product, ProductVariant } from '@prisma/client'

type ProductWithVariants = Product & {
  variants: ProductVariant[]
}

export default function Bestsellers() {
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProducts() {
      try {
        // 👉 limit = 12 => на бекенді це трактуємо як "бестселери"
        const res = await fetch('/api/products?limit=12', {
          cache: 'no-store',
        })
        const data = (await res.json()) as ProductWithVariants[]
        setProducts(data)
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
        <h2 className="text-2xl font-semibold mb-5 uppercase">Новинки</h2>

        <div className="relative">
          <div className="flex gap-5 overflow-x-auto scrollbar-always snap-x pb-2">
            {loading ? (
              // skeletons
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="min-w-[260px] snap-start">
                  <div className="relative aspect-3/4 bg-gray-100 animate-pulse" />
                  <div className="mt-3 h-4 bg-gray-100 w-3/4 animate-pulse" />
                </div>
              ))
            ) : products.length === 0 ? (
              <div className="text-gray-500 text-sm">
                Поки що немає бестселерів.
              </div>
            ) : (
              products.map((p) => {
                const firstVariant = p.variants[0]

                const imageSrc =
                  firstVariant?.image && firstVariant.image.length > 0
                    ? firstVariant.image
                    : placeholder

                const price =
                  (typeof firstVariant?.priceUAH === 'number'
                    ? firstVariant.priceUAH
                    : null) ??
                  (typeof p.basePriceUAH === 'number'
                    ? p.basePriceUAH
                    : null) ??
                  0

                return (
                  <div key={p.id} className="min-w-[260px] snap-start">
                    <Link href={`/products/${p.slug}`}>
                      <div className="relative aspect-3/4 bg-gray-100 overflow-hidden border">
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
