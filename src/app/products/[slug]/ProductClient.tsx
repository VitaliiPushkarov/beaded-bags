'use client'
import { useEffect, useMemo, useState, Suspense, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'

import VariantSwatches from '@/components/product/VariantSwatches'
import { useCart } from '@/app/store/cart'
import { useUI } from '@/app/store/ui'
import {
  Product,
  ProductVariant,
  ProductVariantImage,
  ProductVariantStrap,
  ProductVariantAddon,
} from '@prisma/client'
import ProductGallery from '@/components/ProductGallery'
import ProductTabs from '@/components/product/ProductTabs'
import YouMayAlsoLike from '@/components/YouMayAlsoLike'
import { pushMetaViewContent } from '@/lib/analytics/datalayer'
import { useProductAddons, type AddonVariantUI } from './useProductAddons'
import { usePreorder } from './usePreorder'
import { ProductActions } from './ProductActions'
import { PreorderModal } from './PreOrderModal'
import { AddonsSection } from './AddonsSection'

type StrapImageUI = { url: string; sort?: number | null }

type StrapWithImages = ProductVariantStrap & {
  images?: StrapImageUI[]
}

type VariantWithImagesStrapsAndAddons = ProductVariant & {
  images: ProductVariantImage[]
  straps: StrapWithImages[]
  addonsOnVariant?: (ProductVariantAddon & {
    addonVariant: AddonVariantUI
  })[]
}

export type ProductWithVariants = Product & {
  variants: VariantWithImagesStrapsAndAddons[]
}

export function ProductClient({ p }: { p: ProductWithVariants }) {
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const variantFromUrl = sp.get('variant') || undefined

  const [variantId, setVariantId] = useState<string | undefined>(
    p.variants?.[0]?.id
  )
  const [strapId, setStrapId] = useState<string | undefined>(undefined)

  const openCart = useUI((s) => s.openCart)

  const v = useMemo(
    () =>
      p.variants?.find((x) => x.id === variantId) ?? p.variants?.[0] ?? null,
    [p.variants, variantId]
  )
  const {
    preorderOpen,
    preorderStatus,
    leadName,
    setLeadName,
    leadContact,
    setLeadContact,
    leadComment,
    setLeadComment,
    openPreorder,
    closePreorder,
    submitPreorder,
  } = usePreorder({ product: p, variant: v, strapId })

  const {
    availableAddons,
    selectedAddonVariantIds,
    toggleAddon,
    addonsTotal,
    addonsByVariantId,
    addonPrice,
    addonImageUrl,
  } = useProductAddons(v)

  const didInitVariantFromUrlRef = useRef(false)

  // init variant from URL once (URL is source of truth only on initial load)
  useEffect(() => {
    if (didInitVariantFromUrlRef.current) return
    if (!p.variants?.length) return

    if (variantFromUrl) {
      const ok = p.variants.some((vv) => vv.id === variantFromUrl)
      if (ok) setVariantId(variantFromUrl)
    }

    didInitVariantFromUrlRef.current = true
  }, [variantFromUrl, p.variants])

  // sync state -> URL (when user selects a variant)
  useEffect(() => {
    if (!variantId) return

    const current = sp.get('variant') || ''
    if (current === variantId) return

    const params = new URLSearchParams(sp.toString())
    params.set('variant', variantId)

    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [variantId, sp, router, pathname])

  // Обраний ремінець для поточного варіанту
  const selectedStrap = useMemo(
    () => v?.straps?.find((s) => s.id === strapId) ?? null,
    [v, strapId]
  )

  // Коли змінюється варіант — автоматично обираємо перший ремінець (якщо є)
  useEffect(() => {
    if (v && v.straps && v.straps.length > 0) {
      setStrapId(v.straps[0].id)
    } else {
      setStrapId(undefined)
    }
  }, [v])

  const variantInStock = !!v?.inStock
  const add = useCart((s) => s.add)

  // Ціна сумки — статична, прикраси вираховуються окремо
  const basePrice = v?.priceUAH ?? p.basePriceUAH ?? 0

  // --- Meta Pixel via GTM: ViewContent (fires once per selected variant) ---
  const viewedKeyRef = useRef<string>('')
  useEffect(() => {
    if (!v) return

    const contentId = v.id
    const contentName = `${p.name}${v.color ? ` — ${v.color}` : ''}`
    const key = `${p.id}:${contentId}`

    // prevent duplicates on re-renders / StrictMode
    if (viewedKeyRef.current === key) return
    viewedKeyRef.current = key

    pushMetaViewContent({
      contentId,
      contentName,
      value: basePrice, // product base price only; addons are separate items
      productId: p.id,
      variantId: v.id,
      slug: p.slug,
    })
  }, [p.id, p.name, p.slug, v?.id, v?.color, basePrice])

  const galleryImages = useMemo(() => {
    if (!v) return ['/img/placeholder.png']

    const base: string[] = []
    const seen = new Set<string>()

    // 1) base variant images
    if (Array.isArray(v.images) && v.images.length > 0) {
      ;[...v.images]
        .sort((a, b) => a.sort - b.sort)
        .forEach((img) => {
          const url = img.url?.trim()
          if (!url) return
          if (seen.has(url)) return
          seen.add(url)
          base.push(url)
        })
    }

    // fallback to single variant image
    if (v.image) {
      const url = v.image.trim()
      if (url && !seen.has(url)) {
        seen.add(url)
        base.push(url)
      }
    }

    if (!base.length) base.push('/img/placeholder.png')

    // 2) strap-specific gallery (preferred)
    const strapFirst: string[] = []
    if (selectedStrap) {
      const strapImgs = (selectedStrap.images ?? [])
        .map((i) => ({
          url: (i.url ?? '').trim(),
          sort: typeof i.sort === 'number' ? i.sort : 0,
        }))
        .filter((i) => !!i.url)
        .sort((a, b) => a.sort - b.sort)
        .map((i) => i.url)

      if (strapImgs.length) {
        strapFirst.push(...strapImgs)
      } else {
        // fallback to single strap image
        const one = (
          selectedStrap.mainImageUrl ||
          selectedStrap.imageUrl ||
          ''
        ).trim()
        if (one) strapFirst.push(one)
      }
    }

    if (!strapFirst.length) return base

    // 3) merge (strap images first) with dedupe
    const merged: string[] = []
    const mergedSeen = new Set<string>()

    for (const url of [...strapFirst, ...base]) {
      if (!url) continue
      if (mergedSeen.has(url)) continue
      mergedSeen.add(url)
      merged.push(url)
    }

    return merged.length ? merged : base
  }, [v, selectedStrap])

  const handleAddToCart = () => {
    if (!v) return

    // 1) додаємо в кошик сумку (тільки її ціна)
    add({
      productId: p.id,
      variantId: v.id,
      name: `${p.name}${v.color ? ` — ${v.color}` : ''}`,
      priceUAH: basePrice,
      image: galleryImages[0],
      qty: 1,
      slug: p.slug,
      strapName: selectedStrap?.name ?? null,
    })

    // 2) додаємо в кошик кожну обрану прикрасу як окремий товар
    selectedAddonVariantIds.forEach((addonVariantId) => {
      const addonV = addonsByVariantId[addonVariantId]
      if (!addonV) return

      const name = `${addonV.product.name}${
        addonV.color ? ` — ${addonV.color}` : ''
      }`

      add({
        productId: addonV.product.id,
        variantId: addonV.id,
        name,
        priceUAH: addonPrice(addonV),
        image: addonImageUrl(addonV) || galleryImages[0],
        qty: 1,
        slug: addonV.product.slug,
        strapName: null,
      })
    })

    openCart()
  }

  return (
    <Suspense fallback={<div className="p-6 text-center">Завантаження…</div>}>
      <section className="mx-auto flex flex-col items-center md:items-stretch md:flex-row md:justify-between gap-4 md:gap-10 mb-[60px] md:px-6">
        {/* Ліва колонка: карусель */}
        <ProductGallery images={galleryImages} />

        {/* Права колонка */}
        <div className="flex flex-col items-start w-full lg:w-[33%]">
          <h2 className=" md:text-[38px] text-2xl font-fixel-display font-medium md:mb-6 mb-3">
            {p.name}
          </h2>

          <div className=" text-lg md:text-2xl mb-1">{basePrice} ₴</div>
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
                : 'Відкрито передзамовлення (7–14 робочих днів). Залиште контакт — ми напишемо вам.'}
            </span>
          </div>
          {/* Divider */}
          <div className="w-full border-t border-gray-200 mb-3" />
          {/* Color + variant swatches and strap selection */}
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

              {/* Вибір ремінця */}
              {v?.straps && v.straps.length > 0 && (
                <div className="mt-4 w-full">
                  <div className="mb-2 flex items-center gap-2 text-sm text-gray-600">
                    <span>Ремінець:</span>
                    {selectedStrap && (
                      <span className="font-medium text-gray-900">
                        {selectedStrap.name}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[...v.straps]
                      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
                      .map((s) => {
                        const isActive = s.id === strapId
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setStrapId(s.id)}
                            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition cursor-pointer ${
                              isActive
                                ? 'border-black bg-black text-white'
                                : 'border-gray-300 bg-white text-gray-900 hover:border-black'
                            }`}
                          >
                            {s.imageUrl && (
                              <span className="relative w-6 h-6 rounded-full overflow-hidden bg-gray-100">
                                <Image
                                  src={s.imageUrl}
                                  alt={s.name}
                                  fill
                                  className="object-cover"
                                />
                              </span>
                            )}
                            <span>{s.name}</span>
                          </button>
                        )
                      })}
                  </div>
                </div>
              )}
              <AddonsSection
                availableAddons={availableAddons}
                selectedAddonVariantIds={selectedAddonVariantIds}
                toggleAddon={toggleAddon}
                addonPrice={addonPrice}
                addonImageUrl={addonImageUrl}
                addonsTotal={addonsTotal}
              />
            </>
          )}

          <ProductActions
            variantInStock={variantInStock}
            onAddToCart={handleAddToCart}
            onPreorder={openPreorder}
          />

          <PreorderModal
            open={preorderOpen}
            status={preorderStatus}
            productName={p.name}
            variantLabel={v?.color ?? undefined}
            leadName={leadName}
            setLeadName={setLeadName}
            leadContact={leadContact}
            setLeadContact={setLeadContact}
            leadComment={leadComment}
            setLeadComment={setLeadComment}
            onClose={closePreorder}
            onSubmit={submitPreorder}
          />

          <ProductTabs
            description={p.description}
            info={p.info}
            dimensions={p.dimensions}
          />
          <div className="mt-8 space-y-3 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>Відправка протягом 1–3 днів</span>
            </div>

            <p>
              Маєте питання? Напишіть нам у{' '}
              <a
                href="https://instagram.com/gerdan.studio"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                Instagram
              </a>
              .
            </p>
          </div>
        </div>
      </section>
      <YouMayAlsoLike currentSlug="" />
    </Suspense>
  )
}
