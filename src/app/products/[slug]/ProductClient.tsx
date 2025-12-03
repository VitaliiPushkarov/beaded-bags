'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

import VariantSwatches from '@/components/product/VariantSwatches'
import { useCart } from '@/app/store/cart'
import { useUI } from '@/app/store/ui'
import { Product, ProductVariant, ProductVariantImage } from '@prisma/client'
import ProductGallery from '@/components/ProductGallery'
import ProductTabs from '@/components/product/ProductTabs'

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

  const variantInStock = !!v?.inStock
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

    // fallback to variant image
    if (v.image && !list.includes(v.image)) {
      list.push(v.image)
    }

    if (!list.length) list.push('/img/placeholder.png')

    return list
  }, [v])
  const price = v?.priceUAH ?? p.basePriceUAH ?? 0

  return (
    <Suspense fallback={<div className="p-6 text-center">Завантаження…</div>}>
      <section className="mx-auto flex flex-col items-center md:items-stretch md:flex-row md:justify-between gap-4 md:gap-10">
        {/* Ліва колонка: карусель */}
        <ProductGallery images={galleryImages} />

        {/* Права колонка */}
        <div className="flex flex-col items-start w-full md:w-[33%]">
          <h2 className=" text-[38px] font-fixel-display font-medium mb-6">
            {p.name}
          </h2>

          <div className=" text-lg md:text-[25px] mb-[34px]">{price} ₴</div>
          {/* inStock Status */}
          <div className="flex items-center gap-2 text-sm mb-3">
            <span
              className={`inline-block h-2 w-2 rounded-full flex-none ${
                variantInStock ? 'bg-green-500' : 'bg-red-300'
              }`}
            />
            <span
              className={variantInStock ? 'text-green-700' : 'text-red-500'}
            >
              {variantInStock
                ? 'Є в наявності'
                : 'Відкрито передзамовлення! (відправка протягом 7–14 робочих днів з моменту замовлення)'}
            </span>
          </div>
          {/* Divider */}
          <div className="w-full border-t border-gray-200 mb-3" />
          {/* Color + variant swatches */}
          {p.variants.length > 0 && (
            <>
              <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
                <span>Колір:</span>
                {v?.color && (
                  <span className="font-medium text-gray-900">{v.color}</span>
                )}
              </div>

              <VariantSwatches
                variants={p.variants}
                value={variantId!}
                onChange={setVariantId}
              />
            </>
          )}

          {/* Button "Add to cart" */}
          <button
            className="mt-3 inline-flex items-center justify-center w-full h-10 bg-black text-white px-5 text-[18px] py-2 hover:bg-[#FF3D8C] transition disabled:opacity-50 cursor-pointer"
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

          <ProductTabs
            description={p.description}
            info={p.info}
            dimensions={p.dimensions}
          />
        </div>
      </section>
    </Suspense>
  )
}
