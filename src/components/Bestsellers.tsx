'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'

type BestsellerProduct = {
  id?: string
  productId?: string // на випадок старих даних
  slug: string
  name: string
  basePriceUAH?: number | null
  priceUAH?: number | null
  images?: string[] | null
  mainImage?: string | null
}

export default function Bestsellers() {
  const [products, setProducts] = useState<BestsellerProduct[]>([])

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch('/api/products')
        const data = await res.json()
        setProducts(data)
      } catch (err) {
        console.error('❌ Failed to load products:', err)
      }
    }
    loadProducts()
  }, [])

  return (
    <section className="mx-auto py-12">
      <div className="max-w-full px-6">
        <h2 className="text-2xl font-semibold mb-5">БЕСТСЕЛЕРИ</h2>

        <div className="relative">
          <div className="flex gap-5 overflow-x-auto scrollbar-always snap-x pb-2">
            {products.map((p) => {
              // 1) визначаємо картинку
              const imageSrc =
                (Array.isArray(p.images) && p.images[0]) ||
                p.mainImage ||
                '/img/placeholder.png' // зроби свій плейсхолдер

              // 2) ціна
              const price = p.priceUAH ?? p.basePriceUAH ?? 0

              // 3) ключ — беремо що є
              const key = p.id ?? p.productId ?? p.slug

              return (
                <div key={key} className="min-w-[260px] snap-start">
                  <Link href={`/products/${p.slug}`}>
                    <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden border-1">
                      <Image
                        src={imageSrc}
                        alt={p.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <div className="text-sm truncate">{p.name}</div>
                      <div className="text-sm text-gray-700 whitespace-nowrap">
                        {price} грн
                      </div>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
