'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import VariantSwatches from '@/components/product/VariantSwatches'
import { useCart } from '@/app/store/cart'
import { useUI } from '@/app/store/ui'
import { Product, ProductVariant } from '@prisma/client'

type ProductWithVariants = Product & {
  variants: ProductVariant[]
}

export function ProductClient({ p }: { p: ProductWithVariants }) {
  const sp = useSearchParams()
  const variantFromUrl = sp.get('variant') || undefined

  const [variantId, setVariantId] = useState<string | undefined>(
    p.variants?.[0]?.id
  )
  const openCart = useUI((s) => s.openCart)

  useEffect(() => {
    if (!variantFromUrl || !p.variants?.length) return
    const ok = p.variants.some((v) => v.id === variantFromUrl)
    if (ok) setVariantId(variantFromUrl)
  }, [variantFromUrl, p.variants])

  const v = useMemo(
    () =>
      p.variants?.find((x) => x.id === variantId) ?? p.variants?.[0] ?? null,
    [p.variants, variantId]
  )

  const add = useCart((s) => s.add)
  const price = v?.priceUAH ?? p.basePriceUAH ?? 0

  return (
    <Suspense fallback={<div className="p-6 text-center">Завантаження…</div>}>
      <section className="mx-auto flex flex-col items-center md:items-stretch md:flex-row md:justify-between gap-4 md:gap-[60px]">
        <div className="relative h-[380px] w-full md:h-[580px] md:w-[476px] overflow-hidden bg-gray-100">
          {v?.image && (
            <Image
              src={v.image}
              alt={`${p.name} — ${v.color}`}
              fill
              className="object-cover"
              priority
            />
          )}
        </div>

        <div className="flex flex-col items-start w-full md:w-[50%]">
          <h2 className="text-xl md:text-3xl font-medium font-fixel-display mb-[12px] md:mb-[24px]">
            {p.name}
          </h2>

          <div className="mt-2 text-lg md:text-2xl mb-[12px] md:mb-[24px]">
            {price} ₴
          </div>

          <div className="mb-3 text-sm text-gray-600">Колір:</div>
          {p.variants?.length > 0 && (
            <VariantSwatches
              variants={p.variants}
              value={variantId ?? p.variants[0].id}
              onChange={setVariantId}
            />
          )}

          <button
            className="mt-6 inline-flex items-center justify-center w-full bg-black text-white px-5 py-2 hover:bg-[#FF3D8C] transition disabled:opacity-50 cursor-pointer"
            disabled={!v?.inStock}
            onClick={() => {
              if (!v) return
              add({
                productId: p.id,
                variantId: v.id,
                name: `${p.name} — ${v.color ?? ''}`,
                priceUAH: price,
                image: v.image ?? '/img/placeholder.png',
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
