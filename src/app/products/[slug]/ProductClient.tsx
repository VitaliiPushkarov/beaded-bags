'use client'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import VariantSwatches from '@/components/product/VariantSwatches'
import { Product } from '@/lib/products'
import { useCart } from '@/app/store/cart'
import { useUI } from '@/app/store/ui'

export function ProductClient({ p }: { p: Product }) {
  const params = useSearchParams()
  const variantFromUrl = params.get('variant') || undefined

  const [variantId, setVariantId] = useState(p.variants[0]?.id)
  const openCart = useUI((s) => s.openCart)

  useEffect(() => {
    if (!variantFromUrl) return
    const ok = p.variants.some((v) => v.id === variantFromUrl)
    if (ok) setVariantId(variantFromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantFromUrl])

  const v = useMemo(
    () => p.variants.find((x) => x.id === variantId) ?? p.variants[0],
    [p.variants, variantId]
  )

  const add = useCart((s) => s.add)
  const price = v?.priceUAH ?? p.basePriceUAH

  return (
    <section className="mx-auto max-w-[1200px] grid md:grid-cols-2 gap-10 px-4 py-10">
      <div className="relative aspect-[4/3] rounded overflow-hidden bg-gray-100">
        {v && (
          <Image
            src={v.image}
            alt={`${p.name} — ${v.color}`}
            fill
            className="object-cover"
            priority
          />
        )}
      </div>

      <div>
        <h1 className="text-3xl font-fixel-display">
          {p.name} — {v?.color}
        </h1>
        <div className="mt-2 text-2xl">{price} грн</div>
        <hr className="my-6" />

        <div className="mb-3 text-sm text-gray-600">Колір</div>
        <VariantSwatches
          variants={p.variants}
          value={variantId!}
          onChange={setVariantId}
        />

        <button
          className="mt-6 inline-flex items-center justify-center rounded bg-black text-white px-5 py-2 hover:bg-[#FF3D8C] transition disabled:opacity-50 cursor-pointer"
          disabled={!v?.inStock}
          onClick={() => {
            if (!v) return
            add({
              productId: p.slug,
              variantId: v.id,
              name: `${p.name} — ${v.color}`,
              priceUAH: price,
              image: v.image,
              qty: 1,
              slug: p.slug,
            })
            openCart()
          }}
        >
          Додати в кошик
        </button>

        {p.description && (
          <p className="mt-6 text-gray-700 leading-relaxed">{p.description}</p>
        )}
      </div>
    </section>
  )
}
