'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

import VariantSwatches from '@/components/product/VariantSwatches'
import { useCart } from '@/app/store/cart'
import { useUI } from '@/app/store/ui'
import { Product, ProductVariant, ProductVariantImage } from '@prisma/client'
import ProductGallery from '@/components/ProductGallery'

type VariantWithImages = ProductVariant & {
  images: ProductVariantImage[]
}

type ProductWithVariants = Product & {
  variants: VariantWithImages[]
}

export function ProductClient({ p }: { p: ProductWithVariants }) {
  const sp = useSearchParams()
  const variantFromUrl = sp.get('variant') || undefined

  const [variantId, setVariantId] = useState<string | undefined>(
    p.variants?.[0]?.id
  )
  const openCart = useUI((s) => s.openCart)

  //sync variantId with URL param
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

  const galleryImages = useMemo(() => {
    if (!v) return ['/img/placeholder.png']

    const list: string[] = []

    if (Array.isArray(v.images) && v.images.length > 0) {
      v.images
        .sort((a, b) => a.sort - b.sort)
        .forEach((img) => {
          if (img.url && !list.includes(img.url)) list.push(img.url)
        })
    }

    // fallback – oldschool поле image
    if (v.image && !list.includes(v.image)) {
      list.push(v.image)
    }

    if (!list.length) list.push('/img/placeholder.png')

    return list
  }, [v])
  const price = v?.priceUAH ?? p.basePriceUAH ?? 0

  return (
    <Suspense fallback={<div className="p-6 text-center">Завантаження…</div>}>
      <section className="mx-auto flex flex-col items-center md:items-stretch md:flex-row md:justify-between gap-4 md:gap-[60px]">
        {/* Ліва колонка: карусель */}
        <ProductGallery images={galleryImages} />

        {/* Права колонка */}
        <div className="flex flex-col items-start w-full md:w-[33%]">
          <h2 className="text-xl md:text-3xl font-medium font-fixel-display mb-[12px] md:mb-[24px]">
            {p.name}
          </h2>

          <div className="mt-2 text-lg md:text-2xl mb-[12px] md:mb-[24px]">
            {price} ₴
          </div>

          {/* свотчі кольорів */}
          {p.variants.length > 1 && (
            <>
              <div className="mb-3 text-sm text-gray-600">Колір:</div>
              <VariantSwatches
                variants={p.variants}
                value={variantId!}
                onChange={setVariantId}
              />
            </>
          )}

          <button
            className="mt-6 inline-flex items-center justify-center w-full bg-black text-white px-5 py-2 hover:bg-[#FF3D8C] transition disabled:opacity-50 cursor-pointer"
            disabled={!v?.inStock}
            onClick={() => {
              if (!v) return
              add({
                productId: p.id,
                variantId: v.id,
                name: `${p.name}${v.color ? ` — ${v.color}` : ''}`,
                priceUAH: price,
                image: galleryImages[0],
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
