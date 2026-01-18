'use client'
import Link from 'next/link'
import Image from 'next/image'
import type {
  Product,
  ProductVariant,
  ProductVariantImage,
  ProductVariantStrap,
} from '@prisma/client'
import { useEffect, useMemo, useState } from 'react'
import VariantSwatches from '@/components/product/VariantSwatches'
/* import { useCart } from '@/app/store/cart'
import { useUI } from '@/app/store/ui' */

export type ProductWithVariants = Product & {
  variants: (ProductVariant & {
    images: ProductVariantImage[]
    straps: ProductVariantStrap[]
  })[]
}

export default function ProductCardLarge({ p }: { p: ProductWithVariants }) {
  const [variantId, setVariantId] = useState(p.variants[0]?.id)
  const v = useMemo(
    () => p.variants.find((x) => x.id === variantId) ?? p.variants[0],
    [p.variants, variantId]
  )

  // If the selected variant was filtered out (e.g. by "in stock"), fall back to the first available one
  const activeVariantId = v?.id ?? p.variants[0]?.id

  useEffect(() => {
    if (!p.variants?.length) return
    const exists = variantId && p.variants.some((x) => x.id === variantId)
    if (!exists) setVariantId(p.variants[0].id)
  }, [p.variants, variantId])

  /* const add = useCart((s) => s.add)
  const openCart = useUI((s) => s.openCart) */
  const basePrice = v?.priceUAH ?? p.basePriceUAH ?? 0
  const discountUAH = Math.max(0, v?.discountUAH ?? 0)
  const finalPrice = Math.max(0, basePrice - discountUAH)
  const hasDiscount = discountUAH > 0 && finalPrice < basePrice
  const isInStock = v?.inStock ?? p.inStock
  const isPreorder = !isInStock

  const CARD_SIZES =
    '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw'

  const [isHovered, setIsHovered] = useState(false)

  // Витягуємо зображення саме з варіанту, з урахуванням поля hover та sort
  const variantImages = (v?.images || [])
    .slice()
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))

  const primaryImage =
    variantImages[0]?.url || v?.image || '/img/placeholder.png'

  const hoverImage =
    variantImages.find((img) => img.hover)?.url ||
    variantImages[1]?.url ||
    primaryImage

  return (
    <article className=" overflow-hidden bg-white mb-8 md:mb-0">
      {/* зображення прив'язане до варіанту */}
      <Link href={`/products/${p.slug}?variant=${activeVariantId ?? ''}`}>
        <div
          className="group relative md:h-[560px] aspect-3/4 2xl:aspect-auto bg-gray-100 2xl:h-[720px] overflow-hidden"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isPreorder && (
            <div className="absolute md:top-2 right-2 z-20">
              <span className=" text-black text-[10px] md:text-[11px] uppercase tracking-tight md:tracking-wide md:px-2 md:py-1">
                Доступно до передзамовлення
              </span>
            </div>
          )}
          {v && (
            <>
              <Image
                src={primaryImage}
                alt={`${p.name} — ${v.color}`}
                fill
                className={`object-cover transition-opacity duration-300 ${
                  isHovered ? 'opacity-0 scale-[1.02]' : 'opacity-100'
                }`}
                priority={false}
                sizes={CARD_SIZES}
              />
              {hoverImage && (
                <Image
                  src={hoverImage}
                  alt={`${p.name} — ${v.color} — view 2`}
                  fill
                  className={`hidden md:block object-cover transition-opacity duration-300 ${
                    isHovered ? 'opacity-100 scale-[1.02]' : 'opacity-0'
                  }`}
                  priority={false}
                  sizes={CARD_SIZES}
                />
              )}
            </>
          )}
        </div>
      </Link>

      <div className=" p-1 md:p-3">
        <div className="flex items-center justify-between flex-wrap">
          <Link href={`/products/${p.slug}?variant=${activeVariantId ?? ''}`}>
            <h3 className="text-sm md:text-xl font-normal truncate">
              {p.name}
            </h3>
          </Link>

          <div className="whitespace-nowrap flex flex-col items-end">
            <div className="flex items-baseline gap-2">
              <div className="text-sm md:text-xl font-light">
                {finalPrice} ₴
              </div>
              {hasDiscount && (
                <>
                  <div className="text-xs md:text-base text-gray-500 line-through">
                    {basePrice} ₴
                  </div>
                  {/* <span className="text-[10px] md:text-xs border border-black rounded-full px-2 py-0.5">
                    -{discountUAH} ₴
                  </span> */}
                </>
              )}
            </div>
            {hasDiscount && (
              <div className="text-[11px] md:text-xs text-gray-600">
                Пропозиція діє до 10.01
              </div>
            )}
          </div>
        </div>

        {/* свотчі — міняють фото та назву */}
        <div className="mt-2 md:mt-3">
          <VariantSwatches
            variants={p.variants}
            value={activeVariantId ?? ''}
            onChange={setVariantId}
          />
        </div>

        {/* швидке додавання в кошик саме обраного кольору */}
        {/*  <button
          className="mt-4 w-full rounded bg-black text-white py-2 text-sm hover:bg-[#FF3D8C] transition disabled:opacity-50 cursor-pointer"
          disabled={!v?.inStock}
          onClick={() => {
            if (!v) return
            add({
              productId: p.id,
              slug: p.slug,
              variantId: v.id,
              name: `${p.name} — ${v.color}`,
              priceUAH: price,
              image: v.image || getFirstImage(),
              qty: 1,
            })
            openCart()
          }}
        >
          Додати в кошик
        </button> */}
      </div>
    </article>
  )
}
