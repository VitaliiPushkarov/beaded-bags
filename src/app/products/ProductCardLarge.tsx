'use client'
import Link from 'next/link'
import Image from 'next/image'
import type { Product, ProductVariant } from '@prisma/client'
import { useMemo, useState } from 'react'
import VariantSwatches from '@/components/product/VariantSwatches'
import { useCart } from '@/app/store/cart'
import { useUI } from '@/app/store/ui'

type ProductWithVariants = Product & {
  variants: ProductVariant[]
}

export default function ProductCardLarge({ p }: { p: ProductWithVariants }) {
  const [variantId, setVariantId] = useState(p.variants[0]?.id)
  const v = useMemo(
    () => p.variants.find((x) => x.id === variantId) ?? p.variants[0],
    [p.variants, variantId]
  )
  const add = useCart((s) => s.add)
  const openCart = useUI((s) => s.openCart)
  const price = v?.priceUAH ?? p.basePriceUAH ?? 0

  const getFirstImage = (): string => {
    const images = (p as unknown as { images?: string[] }).images
    if (Array.isArray(images) && images.length > 0) return images[0]
    return '/img/placeholder.png'
  }

  return (
    <article className="border rounded overflow-hidden bg-white">
      {/* зображення прив'язане до варіанту */}
      <Link href={`/products/${p.slug}?variant=${variantId}`}>
        <div className="relative md:h-[550px] h-[460px] lg:h-[501px] bg-gray-100">
          {v && (
            <Image
              src={v.image || getFirstImage()}
              alt={`${p.name} — ${v.color}`}
              fill
              className="object-cover transition-transform duration-300 hover:scale-[1.02]"
              priority={false}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          )}
        </div>
      </Link>

      <div className="border-t p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm md:text-base truncate">{p.name}</h3>
          <div className="text-sm md:text-base whitespace-nowrap">
            {price} ₴
          </div>
        </div>

        {/* свотчі — міняють фото та назву */}
        <div className="mt-3">
          <VariantSwatches
            variants={p.variants}
            value={variantId!}
            onChange={setVariantId}
          />
        </div>

        {/* швидке додавання в кошик саме обраного кольору */}
        <button
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
        </button>
      </div>
    </article>
  )
}
