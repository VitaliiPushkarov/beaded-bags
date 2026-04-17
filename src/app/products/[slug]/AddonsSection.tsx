import Link from 'next/link'
import Image from 'next/image'
import { Product, ProductVariant, ProductVariantImage } from '@prisma/client'
import { useLocale, useLocaleNumberFormat, useT } from '@/lib/i18n'
import {
  calcLocalizedDiscountedPrice,
  formatLocalizedMoney,
  pickLocalizedText,
} from '@/lib/localized-product'

type AddonVariantUI = ProductVariant & {
  product: Product
  images: ProductVariantImage[]
}

export function AddonsSection(props: {
  availableAddons: AddonVariantUI[]
  selectedAddonVariantIds: string[]
  toggleAddon: (id: string) => void
  addonPricing: (av: AddonVariantUI) => {
    basePriceUAH: number
    finalPriceUAH: number
    hasDiscount: boolean
    discountPercent: number
    discountUAH: number
  }
  addonImageUrl: (av: AddonVariantUI) => string
  addonsTotal: number
}) {
  const locale = useLocale()
  const numberLocale = useLocaleNumberFormat()
  const t = useT()
  const {
    availableAddons,
    selectedAddonVariantIds,
    toggleAddon,
    addonImageUrl,
  } = props

  const inStockAddons = availableAddons.filter((a) => a.inStock)

  if (!inStockAddons.length) return null

  return (
    <>
      <div className="mt-6 w-full">
        <div className="mb-3 text-sm font-medium text-gray-700">
          {t('Доповнити:', 'Add-ons:')}
        </div>

        <div className="-mx-1 overflow-x-auto">
          <div className="flex gap-3 px-1 pb-1">
            {inStockAddons.map((addonV) => {
              const isSelected = selectedAddonVariantIds.includes(addonV.id)
              const pricing = calcLocalizedDiscountedPrice({
                locale,
                priceUAH: addonV.priceUAH ?? addonV.product.basePriceUAH ?? 0,
                priceUSD:
                  (addonV as any).priceUSD ??
                  (addonV.product as any).basePriceUSD ??
                  null,
                discountPercent: addonV.discountPercent,
                discountUAH: addonV.discountUAH ?? 0,
              })
              const title = pickLocalizedText(
                addonV.product.name,
                (addonV.product as any).nameEn,
                locale,
              )
              const finalPriceLabel = formatLocalizedMoney(
                pricing.finalPrice,
                pricing.currency,
                numberLocale,
              )
              const basePriceLabel = formatLocalizedMoney(
                pricing.basePrice,
                pricing.currency,
                numberLocale,
              )
              return (
                <div key={addonV.id} className="relative shrink-0 w-[140px]">
                  {/* Картинка як лінк на сторінку аксесуара */}
                  <Link href={`/products/${addonV.product.slug}#variant=${addonV.id}`}>
                    <div className="relative w-full aspect-4/5 rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={addonImageUrl(addonV)}
                        alt={title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 40vw, 140px"
                        loading="lazy"
                      />
                    </div>
                  </Link>

                  {/* Кнопка + / × у верхньому кутку */}
                  <button
                    type="button"
                    onClick={() => toggleAddon(addonV.id)}
                    className={`absolute top-1 right-1 flex h-8 w-8 items-center justify-center rounded-md border text-base font-medium shadow-sm transition cursor-pointer ${
                      isSelected
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-800 border-gray-300 hover:border-black'
                    }`}
                    style={{ zIndex: 20 }}
                  >
                    {isSelected ? '×' : '+'}
                  </button>

                  {/* Назва + ціна під картинкою */}
                  <div className="mt-2 text-xs text-gray-900">
                    {title}
                  </div>
                  <div className="text-xs text-gray-600 flex items-center gap-1.5 flex-wrap">
                    <span>{finalPriceLabel}</span>
                    {pricing.hasDiscount && (
                      <>
                        <span className="text-[11px] text-gray-500 line-through">
                          {basePriceLabel}
                        </span>
                        <span className="text-[10px] border border-black rounded-full px-1 py-0.5">
                          -{pricing.discountPercent}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {(() => {
        const selectedPricings = inStockAddons
          .filter((addon) => selectedAddonVariantIds.includes(addon.id))
          .map((addon) =>
            calcLocalizedDiscountedPrice({
              locale,
              priceUAH: addon.priceUAH ?? addon.product.basePriceUAH ?? 0,
              priceUSD:
                (addon as any).priceUSD ??
                (addon.product as any).basePriceUSD ??
                null,
              discountPercent: addon.discountPercent,
              discountUAH: addon.discountUAH ?? 0,
            }),
          )

        const selectedTotal = selectedPricings.reduce(
          (sum, pricing) => sum + pricing.finalPrice,
          0,
        )

        if (selectedTotal <= 0) return null

        const totalLabel = formatLocalizedMoney(
          selectedTotal,
          selectedPricings[0]?.currency ?? (locale === 'en' ? 'USD' : 'UAH'),
          numberLocale,
        )

        return (
        <div className="mt-3 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
          {t('Обрані прикраси', 'Selected add-ons')}:{' '}
          <span className="font-medium">+{totalLabel}</span>
        </div>
        )
      })()}
    </>
  )
}
