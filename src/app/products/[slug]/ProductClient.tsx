'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import VariantSwatches from '@/components/product/VariantSwatches'
import { Product } from '@/lib/products'
import { useCart } from '@/app/store/cart'
import { useUI } from '@/app/store/ui'

export function ProductClient({ p }: { p: Product }) {
  const sp = useSearchParams()
  const variantFromUrl = sp.get('variant') || undefined

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
    <Suspense fallback={<div className="p-6 text-center">Завантаження…</div>}>
      <section className="mx-auto grid grid-cols-2">
        <div className="relative h-full min-h-[580px] w-[476px]  overflow-hidden bg-gray-100">
          {v && (
            <Image
              src={v.image}
              alt={`${p.name} — ${v.color}`}
              fill
              className="object-cover "
              priority
            />
          )}
        </div>

        <div className="flex flex-col items-start w-[70%]">
          <h2 className="text-3xl font-medium font-fixel-display mb-[24px]">
            {p.name}
          </h2>
          <div className="mt-2 text-2xl mb-[24px]">{price} ₴</div>

          <div className="mb-3 text-sm text-gray-600">Колір:</div>
          <VariantSwatches
            variants={p.variants}
            value={variantId!}
            onChange={setVariantId}
          />

          <button
            className="mt-6 inline-flex items-center justify-center w-full bg-black text-white px-5 py-2 hover:bg-[#FF3D8C] transition disabled:opacity-50 cursor-pointer"
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
            <p className="mt-6 text-gray-700 leading-relaxed">
              {p.description}
            </p>
          )}
        </div>
      </section>
    </Suspense>
  )
}
