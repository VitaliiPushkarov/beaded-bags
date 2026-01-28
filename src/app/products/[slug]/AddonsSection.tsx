import Link from 'next/link'
import Image from 'next/image'
import { Product, ProductVariant, ProductVariantImage } from '@prisma/client'

type AddonVariantUI = ProductVariant & {
  product: Product
  images: ProductVariantImage[]
}

export function AddonsSection(props: {
  availableAddons: AddonVariantUI[]
  selectedAddonVariantIds: string[]
  toggleAddon: (id: string) => void
  addonPrice: (av: AddonVariantUI) => number
  addonImageUrl: (av: AddonVariantUI) => string
  addonsTotal: number
}) {
  const {
    availableAddons,
    selectedAddonVariantIds,
    toggleAddon,
    addonPrice,
    addonImageUrl,
    addonsTotal,
  } = props

  const inStockAddons = availableAddons.filter((a) => a.inStock)

  if (!inStockAddons.length) return null

  return (
    <>
      <div className="mt-6 w-full">
        <div className="mb-3 text-sm font-medium text-gray-700">Доповнити:</div>

        <div className="-mx-1 overflow-x-auto">
          <div className="flex gap-3 px-1 pb-1">
            {inStockAddons.map((addonV) => {
              const isSelected = selectedAddonVariantIds.includes(addonV.id)
              return (
                <div key={addonV.id} className="relative shrink-0 w-[140px]">
                  {/* Картинка як лінк на сторінку аксесуара */}
                  <Link
                    href={`/products/${addonV.product.slug}?variant=${addonV.id}`}
                  >
                    <div className="relative w-full aspect-4/5 rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={addonImageUrl(addonV)}
                        alt={addonV.product.name}
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
                    {addonV.product.name}
                  </div>
                  <div className="text-xs text-gray-600">
                    {addonPrice(addonV)} ₴
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {addonsTotal > 0 && (
        <div className="mt-3 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
          Обрані прикраси: <span className="font-medium">+{addonsTotal} ₴</span>
        </div>
      )}
    </>
  )
}
