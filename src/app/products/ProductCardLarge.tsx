'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import VariantSwatches from '@/components/product/VariantSwatches'
import {
  calcLocalizedDiscountedPrice,
  formatLocalizedMoney,
  pickLocalizedText,
} from '@/lib/localized-product'
import {
  isOutOfStockStatus,
  isPreorderStatus,
  resolveAvailabilityStatus,
} from '@/lib/availability'
import type { ProductCardDTO } from '@/lib/product-card-dto'
import { useLocale, useLocaleNumberFormat, useT } from '@/lib/i18n'
/* import { useCart } from '@/app/store/cart'
import { useUI } from '@/app/store/ui' */

export type ProductWithVariants = ProductCardDTO

export default function ProductCardLarge({
  p,
  preferredColor,
}: {
  p: ProductWithVariants
  preferredColor?: string
}) {
  const locale = useLocale()
  const numberLocale = useLocaleNumberFormat()
  const t = useT()
  const productName = pickLocalizedText(p.name, p.nameEn, locale)
  const preferredVariantId = useMemo(() => {
    if (!preferredColor) return undefined
    return p.variants.find((x) => {
      const colorLabel = pickLocalizedText(x.color, x.colorEn, locale)
      return colorLabel === preferredColor
    })?.id
  }, [locale, p.variants, preferredColor])

  const [variantId, setVariantId] = useState(
    preferredVariantId ?? p.variants[0]?.id,
  )
  const v = useMemo(
    () => p.variants.find((x) => x.id === variantId) ?? p.variants[0],
    [p.variants, variantId],
  )

  // If the selected variant was filtered out (e.g. by "in stock"), fall back to the first available one
  const activeVariantId = v?.id ?? p.variants[0]?.id

  useEffect(() => {
    if (!p.variants?.length) return
    if (preferredVariantId) {
      if (variantId !== preferredVariantId) {
        setVariantId(preferredVariantId)
      }
      return
    }
    const exists = variantId && p.variants.some((x) => x.id === variantId)
    if (!exists) setVariantId(p.variants[0].id)
  }, [p.variants, preferredVariantId, variantId])

  /* const add = useCart((s) => s.add)
  const openCart = useUI((s) => s.openCart) */
  const { basePrice, finalPrice, hasDiscount, discountPercent, currency } =
    calcLocalizedDiscountedPrice({
      locale,
      priceUAH: v?.priceUAH ?? p.basePriceUAH ?? 0,
      priceUSD: (v as any)?.priceUSD ?? (p as any).basePriceUSD ?? null,
      discountPercent: v?.discountPercent,
      discountUAH: v?.discountUAH ?? 0,
    })
  const finalPriceLabel = formatLocalizedMoney(finalPrice, currency, numberLocale)
  const basePriceLabel = formatLocalizedMoney(basePrice, currency, numberLocale)
  const offerNote = pickLocalizedText(p.offerNote, p.offerNoteEn, locale)
  const variantColorLabel = pickLocalizedText(v?.color, (v as any)?.colorEn, locale)
  const availabilityStatus = resolveAvailabilityStatus({
    availabilityStatus: (v as any)?.availabilityStatus,
    inStock: v?.inStock ?? p.inStock,
  })
  const isPreorder = isPreorderStatus(availabilityStatus)
  const isOutOfStock = isOutOfStockStatus(availabilityStatus)
  const stockBadgeLabel = isPreorder
    ? t('Доступно до передзамовлення', 'Available for preorder')
    : isOutOfStock
      ? t('Немає в наявності', 'Out of stock')
      : null

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

  const productHref = `/products/${p.slug}${
    activeVariantId ? `#variant=${activeVariantId}` : ''
  }`

  return (
    <article className="overflow-hidden bg-white mb-8 md:mb-0">
      {/* зображення прив'язане до варіанту */}
      <Link href={productHref} className="block">
        <div
          className="group relative md:h-[560px] aspect-3/4 2xl:aspect-auto bg-gray-100 2xl:h-[720px] overflow-hidden"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {stockBadgeLabel && (
            <div className="absolute inset-x-0 top-0 z-20">
              <div className="w-full bg-black/58 px-3 py-2 text-center text-[9px] md:text-[10px] font-medium uppercase tracking-[0.08em] leading-[1.05] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.65)] backdrop-blur-[2px]">
                {stockBadgeLabel}
              </div>
            </div>
          )}
          {v && (
            <>
              <Image
                src={primaryImage}
                alt={`${productName} — ${variantColorLabel}`}
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
                  alt={`${productName} — ${variantColorLabel} — view 2`}
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
          <Link href={productHref}>
            <h3 className="text-sm md:text-xl font-normal truncate">
              {productName}
            </h3>
          </Link>

          <div className="whitespace-nowrap flex flex-col items-end">
            <div className="flex items-baseline gap-2">
              <div className="text-sm md:text-xl font-light">
                {finalPriceLabel}
              </div>
              {hasDiscount && (
                <>
                  <div className="text-xs md:text-base text-gray-500 line-through">
                    {basePriceLabel}
                  </div>
                  <span className="text-[10px] text-white md:text-xs border  rounded-full px-2 py-0.5 self-center bg-[#DE2222]">
                    -{discountPercent}%
                  </span>
                </>
              )}
            </div>
            {hasDiscount && offerNote && (
              <div className="text-[11px] md:text-xs text-gray-600">
                {offerNote}
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
