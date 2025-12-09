'use client'
import Link from 'next/link'
import Image from 'next/image'
import type {
  Product,
  ProductVariant,
  ProductVariantImage,
  ProductVariantStrap,
} from '@prisma/client'
import { useMemo, useState } from 'react'
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
  /* const add = useCart((s) => s.add)
  const openCart = useUI((s) => s.openCart) */
  const price = v?.priceUAH ?? p.basePriceUAH ?? 0

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
      <Link href={`/products/${p.slug}?variant=${variantId}`}>
        <div
          className="relative md:h-[560px] aspect-3/4 bg-gray-100 2xl:h-[720px] overflow-hidden"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
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
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              {hoverImage && (
                <Image
                  src={hoverImage}
                  alt={`${p.name} — ${v.color} — view 2`}
                  fill
                  className={`object-cover transition-opacity duration-300 ${
                    isHovered ? 'opacity-100 scale-[1.02]' : 'opacity-0'
                  }`}
                  priority={false}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              )}
            </>
          )}
        </div>
      </Link>

      <div className=" p-1 md:p-3">
        <div className="flex items-center justify-between flex-wrap">
          <Link href={`/products/${p.slug}?variant=${variantId}`}>
            <h3 className="text-sm md:text-xl font-normal truncate">
              {p.name}
            </h3>
          </Link>

          <div className="text-sm md:text-xl font-light whitespace-nowrap">
            {price} ₴
          </div>
        </div>

        {/* свотчі — міняють фото та назву */}
        <div className="mt-2 md:mt-3">
          <VariantSwatches
            variants={p.variants}
            value={variantId!}
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
