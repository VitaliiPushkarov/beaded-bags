'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/app/store/cart'
import { useUI } from '../store/ui'
import {
  calcLocalizedDiscountedPrice,
  formatLocalizedMoney,
  pickLocalizedText,
} from '@/lib/localized-product'
import { useLocale, useLocaleNumberFormat, useT } from '@/lib/i18n'

type ProductCardProps = {
  product: {
    id: string
    slug: string
    name: string
    nameEn?: string | null
    basePriceUAH: number | null
    basePriceUSD?: number | null
    offerNote?: string | null
    offerNoteEn?: string | null
    mainImage?: string | null
    images?: string[] | null
    variants?: {
      id: string
      image: string | null
      inStock: boolean
      priceUAH: number | null
      priceUSD?: number | null
      discountPercent?: number | null
      discountUAH?: number | null
      color: string | null
      colorEn?: string | null
      hex: string | null
    }[]
  }
}

export default function ProductCard({ product }: ProductCardProps) {
  const locale = useLocale()
  const numberLocale = useLocaleNumberFormat()
  const t = useT()
  const add = useCart((s) => s.add)
  const openCart = useUI((s) => s.openCart)

  const firstVariant = product.variants?.[0]
  const { basePrice, finalPrice, hasDiscount, discountPercent, currency } =
    calcLocalizedDiscountedPrice({
      locale,
      priceUAH: firstVariant?.priceUAH ?? product.basePriceUAH ?? 0,
      priceUSD: (firstVariant as any)?.priceUSD ?? product.basePriceUSD ?? null,
      discountPercent: firstVariant?.discountPercent,
      discountUAH: firstVariant?.discountUAH ?? 0,
    })
  const { finalPrice: finalPriceUAHForCart } = calcLocalizedDiscountedPrice({
    locale: 'uk',
    priceUAH: firstVariant?.priceUAH ?? product.basePriceUAH ?? 0,
    discountPercent: firstVariant?.discountPercent,
    discountUAH: firstVariant?.discountUAH ?? 0,
  })
  const finalPriceLabel = formatLocalizedMoney(finalPrice, currency, numberLocale)
  const basePriceLabel = formatLocalizedMoney(basePrice, currency, numberLocale)
  const productName = pickLocalizedText(product.name, product.nameEn, locale)
  const offerNote = pickLocalizedText(product.offerNote, product.offerNoteEn, locale)
  const colorLabel = pickLocalizedText(
    firstVariant?.color,
    (firstVariant as any)?.colorEn,
    locale,
  )

  const img =
    product.mainImage ||
    (product.images && product.images[0]) ||
    firstVariant?.image ||
    '/img/placeholder.png'

  return (
    <article className="border rounded overflow-hidden bg-white flex flex-col">
      <Link
        href={`/products/${product.slug}`}
        className="block relative h-80 bg-gray-100"
      >
        <Image
          src={img}
          alt={productName}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 320px"
        />
      </Link>
      <div className="p-3 flex-1 flex flex-col gap-2">
        <Link
          href={`/products/${product.slug}`}
          className="text-sm font-medium line-clamp-2"
        >
          {productName}
        </Link>
        <div className="text-sm text-gray-700">
          <div className="flex items-baseline gap-2">
            <span>{finalPriceLabel}</span>
            {hasDiscount && (
              <>
                <span className="text-xs text-gray-500 line-through">
                  {basePriceLabel}
                </span>
                <span className="text-[10px] text-white md:text-xs border  rounded-full px-2 py-0.5 self-center bg-[#DE2222]">
                  -{discountPercent}%
                </span>
              </>
            )}
          </div>
          {hasDiscount && offerNote && (
            <div className="text-[11px] text-gray-600">
              {offerNote}
            </div>
          )}
        </div>
        <button
          onClick={() => {
            const item = {
              productId: product.id,
              variantId: firstVariant?.id ?? '',
              name: productName,
              color: colorLabel || null,
              modelSize: null,
              pouchColor: null,
              priceUAH: finalPriceUAHForCart,
              image: img,
              qty: 1,
              slug: product.slug,
              strapId: null,
              strapName: null,
              sizeId: null,
              pouchId: null,
            }

            add(item)
            openCart()
          }}
          className="mt-auto inline-flex items-center justify-center rounded bg-black text-white py-2 text-sm hover:bg-[#FF3D8C] transition"
        >
          {t('Додати в кошик', 'Add to cart')}
        </button>
      </div>
    </article>
  )
}
