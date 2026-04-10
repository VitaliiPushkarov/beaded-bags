'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'

import { useCart } from '@/app/store/cart'
import { useUI } from '@/app/store/ui'
import { pushMetaViewContent } from '@/lib/analytics/datalayer'
import { useProductAddons } from './useProductAddons'
import { usePreorder } from './usePreorder'
import { ProductActions } from './ProductActions'
import { AddonsSection } from './AddonsSection'
import type { ProductWithVariants } from './productTypes'
import { calcDiscountedPrice } from '@/lib/pricing'
import ProductTabs from '@/components/product/ProductTabs'
import VariantSwatches from '@/components/product/VariantSwatches'
import {
  isInStockStatus,
  isPreorderStatus,
  resolveAvailabilityStatus,
} from '@/lib/availability'

const ProductGallery = dynamic(() => import('@/components/ProductGallery'), {
  ssr: false,
})

const YouMayAlsoLike = dynamic(() => import('@/components/YouMayAlsoLike'), {
  ssr: false,
  loading: () => <div className="mt-10 h-40 w-full" />,
})

const PreorderModal = dynamic(
  () => import('./PreOrderModal').then((m) => m.PreorderModal),
  {
    ssr: false,
  },
)

const EMPTY_OPTION_KEY = '__empty__'

function normalizeOptionValue(value: string | null | undefined): string {
  return (value || '').trim()
}

function toOptionKey(value: string | null | undefined): string {
  const normalized = normalizeOptionValue(value)
  return normalized || EMPTY_OPTION_KEY
}

function toOptionLabel(
  value: string | null | undefined,
  fallback: string,
): string {
  const normalized = normalizeOptionValue(value)
  return normalized || fallback
}

function getVariantIdFromHash(hash: string): string | undefined {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  return params.get('variant') || undefined
}

function availabilityRank(
  variant: ProductWithVariants['variants'][number] | null | undefined,
): number {
  const status = resolveAvailabilityStatus({
    availabilityStatus: (variant as any)?.availabilityStatus,
    inStock: variant?.inStock,
  })
  if (status === 'IN_STOCK') return 0
  if (status === 'PREORDER') return 1
  return 2
}

function choosePreferredVariant(
  variants: ProductWithVariants['variants'],
): ProductWithVariants['variants'][number] | null {
  if (!variants.length) return null

  return [...variants].sort((a, b) => {
    const rankDiff = availabilityRank(a) - availabilityRank(b)
    if (rankDiff !== 0) return rankDiff

    const sortA = typeof a.sortCatalog === 'number' ? a.sortCatalog : 0
    const sortB = typeof b.sortCatalog === 'number' ? b.sortCatalog : 0
    if (sortA !== sortB) return sortA - sortB

    return a.id.localeCompare(b.id)
  })[0]
}

function ProductGalleryFallback({ src }: { src: string }) {
  return (
    <div className="relative w-full">
      <div className="relative md:h-[420px] md:h-[580px] w-full overflow-hidden rounded bg-white">
        <Image
          src={src}
          alt="Фото товару"
          fill
          className="object-cover"
          priority
          sizes="(min-width: 1024px) 66vw, 100vw"
        />
      </div>
    </div>
  )
}

function buildVariantSelectionLabel(params: {
  productName: string
  color?: string | null
  size?: string | null
  pouchColor?: string | null
}) {
  const parts = [
    params.color?.trim(),
    params.size?.trim() ? `Розмір: ${params.size.trim()}` : null,
    params.pouchColor?.trim() ? `Мішечок: ${params.pouchColor.trim()}` : null,
  ].filter((part): part is string => Boolean(part))

  return parts.length
    ? `${params.productName} — ${parts.join(' · ')}`
    : params.productName
}

function collectOptionImages(
  option: {
    images?: Array<{ url: string; sort?: number | null }>
    mainImageUrl?: string | null
    imageUrl?: string | null
  } | null,
): string[] {
  if (!option) return []

  const fromList = (option.images ?? [])
    .map((img) => ({
      url: (img.url ?? '').trim(),
      sort: typeof img.sort === 'number' ? img.sort : 0,
    }))
    .filter((img) => !!img.url)
    .sort((a, b) => a.sort - b.sort)
    .map((img) => img.url)

  if (fromList.length) return fromList

  const one = (option.mainImageUrl || option.imageUrl || '').trim()
  return one ? [one] : []
}

export function ProductInteractive({ p }: { p: ProductWithVariants }) {
  const [selectedColorKey, setSelectedColorKey] = useState<string | undefined>()
  const [isColorLockedByEntry, setIsColorLockedByEntry] = useState(false)
  const [selectedSizeId, setSelectedSizeId] = useState<string | undefined>()
  const [selectedPouchId, setSelectedPouchId] = useState<string | undefined>()
  const [strapId, setStrapId] = useState<string | undefined>()
  const [galleryReady, setGalleryReady] = useState(false)

  const openCart = useUI((s) => s.openCart)
  const add = useCart((s) => s.add)

  const colorOptions = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string
        label: string
        hex: string | null
        minSort: number
        rank: number
      }
    >()

    for (const variant of p.variants) {
      const key = toOptionKey(variant.color)
      const existing = map.get(key)
      const rank = availabilityRank(variant)
      const sort =
        typeof variant.sortCatalog === 'number' ? variant.sortCatalog : 0

      if (!existing) {
        map.set(key, {
          key,
          label: toOptionLabel(variant.color, 'Базовий'),
          hex: variant.hex ?? null,
          minSort: sort,
          rank,
        })
        continue
      }

      map.set(key, {
        ...existing,
        hex: existing.hex || variant.hex || null,
        minSort: Math.min(existing.minSort, sort),
        rank: Math.min(existing.rank, rank),
      })
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank
      if (a.minSort !== b.minSort) return a.minSort - b.minSort
      return a.label.localeCompare(b.label, 'uk')
    })
  }, [p.variants])

  const variantsByColor = useMemo(() => {
    if (!selectedColorKey) return p.variants
    return p.variants.filter(
      (variant) => toOptionKey(variant.color) === selectedColorKey,
    )
  }, [p.variants, selectedColorKey])

  const v = useMemo(
    () =>
      choosePreferredVariant(variantsByColor) ||
      choosePreferredVariant(p.variants) ||
      null,
    [variantsByColor, p.variants],
  )

  const sizeOptions = useMemo(
    () =>
      [...(v?.sizes || [])].sort((a, b) => {
        const sa = typeof a.sort === 'number' ? a.sort : 0
        const sb = typeof b.sort === 'number' ? b.sort : 0
        return sa - sb
      }),
    [v],
  )

  const pouchOptions = useMemo(
    () =>
      [...(v?.pouches || [])].sort((a, b) => {
        const sa = typeof a.sort === 'number' ? a.sort : 0
        const sb = typeof b.sort === 'number' ? b.sort : 0
        return sa - sb
      }),
    [v],
  )

  const strapOptions = useMemo(
    () =>
      [...(v?.straps || [])].sort((a, b) => {
        const sa = typeof a.sort === 'number' ? a.sort : 0
        const sb = typeof b.sort === 'number' ? b.sort : 0
        return sa - sb
      }),
    [v],
  )

  const selectedSize = useMemo(
    () => sizeOptions.find((size) => size.id === selectedSizeId) ?? null,
    [sizeOptions, selectedSizeId],
  )

  const selectedPouch = useMemo(
    () => pouchOptions.find((pouch) => pouch.id === selectedPouchId) ?? null,
    [pouchOptions, selectedPouchId],
  )

  const selectedStrap = useMemo(
    () => strapOptions.find((strap) => strap.id === strapId) ?? null,
    [strapOptions, strapId],
  )

  const didInitVariantFromUrlRef = useRef(false)
  useEffect(() => {
    if (didInitVariantFromUrlRef.current) return
    if (typeof window === 'undefined') return
    if (!p.variants?.length) return

    const variantFromHash = getVariantIdFromHash(window.location.hash)
    const hashVariant = variantFromHash
      ? p.variants.find((variant) => variant.id === variantFromHash)
      : null

    const initialVariant = hashVariant || choosePreferredVariant(p.variants)
    if (!initialVariant) return

    setSelectedColorKey(toOptionKey(initialVariant.color))
    setSelectedSizeId(undefined)
    setSelectedPouchId(undefined)
    setStrapId(undefined)
    setIsColorLockedByEntry(Boolean(hashVariant))

    didInitVariantFromUrlRef.current = true
  }, [p.variants])

  useEffect(() => {
    if (!colorOptions.length) return

    const exists =
      selectedColorKey &&
      colorOptions.some((option) => option.key === selectedColorKey)

    if (!exists) {
      setSelectedColorKey(colorOptions[0].key)
    }
  }, [colorOptions, selectedColorKey])

  useEffect(() => {
    if (!sizeOptions.length) {
      if (selectedSizeId !== undefined) setSelectedSizeId(undefined)
      return
    }

    if (
      selectedSizeId &&
      sizeOptions.some((size) => size.id === selectedSizeId)
    ) {
      return
    }

    if (sizeOptions.length === 1) {
      setSelectedSizeId(sizeOptions[0].id)
      return
    }

    setSelectedSizeId(undefined)
  }, [sizeOptions, selectedSizeId])

  useEffect(() => {
    if (!pouchOptions.length) {
      if (selectedPouchId !== undefined) setSelectedPouchId(undefined)
      return
    }

    if (
      selectedPouchId &&
      pouchOptions.some((pouch) => pouch.id === selectedPouchId)
    ) {
      return
    }

    if (pouchOptions.length === 1) {
      setSelectedPouchId(pouchOptions[0].id)
      return
    }

    setSelectedPouchId(undefined)
  }, [pouchOptions, selectedPouchId])

  useEffect(() => {
    if (!strapOptions.length) {
      if (strapId !== undefined) setStrapId(undefined)
      return
    }

    if (strapId && strapOptions.some((strap) => strap.id === strapId)) {
      return
    }

    setStrapId(undefined)
  }, [strapOptions, strapId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!v?.id) return

    const current = getVariantIdFromHash(window.location.hash) || ''
    if (current === v.id) return

    const url = `${window.location.pathname}${window.location.search}#variant=${v.id}`
    window.history.replaceState(window.history.state, '', url)
  }, [v?.id])

  useEffect(() => {
    setGalleryReady(true)
  }, [])

  const selectedSizeExtraPriceUAH = useMemo(() => {
    const raw = Number(selectedSize?.extraPriceUAH ?? 0)
    if (!Number.isFinite(raw)) return 0
    return Math.max(0, Math.round(raw))
  }, [selectedSize])

  const selectedPouchExtraPriceUAH = useMemo(() => {
    const raw = Number(selectedPouch?.extraPriceUAH ?? 0)
    if (!Number.isFinite(raw)) return 0
    return Math.max(0, Math.round(raw))
  }, [selectedPouch])

  const selectedStrapExtraPriceUAH = useMemo(() => {
    const raw = Number(selectedStrap?.extraPriceUAH ?? 0)
    if (!Number.isFinite(raw)) return 0
    return Math.max(0, Math.round(raw))
  }, [selectedStrap])

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
    addonPricing,
    addonPrice,
    addonImageUrl,
  } = useProductAddons(v)

  const availabilityStatus = resolveAvailabilityStatus({
    availabilityStatus: (v as any)?.availabilityStatus,
    inStock: v?.inStock,
  })
  const variantInStock = isInStockStatus(availabilityStatus)
  const variantPreorder = isPreorderStatus(availabilityStatus)

  const { basePriceUAH, finalPriceUAH, hasDiscount, discountPercent } =
    calcDiscountedPrice({
      basePriceUAH: v?.priceUAH ?? p.basePriceUAH ?? 0,
      discountPercent: v?.discountPercent,
      discountUAH: v?.discountUAH ?? 0,
    })

  const extraTotalUAH =
    selectedSizeExtraPriceUAH +
    selectedPouchExtraPriceUAH +
    selectedStrapExtraPriceUAH

  const basePriceWithOptionsUAH = basePriceUAH + extraTotalUAH
  const finalPriceWithOptionsUAH = finalPriceUAH + extraTotalUAH

  const shippingNote =
    ((v as any)?.shippingNote as string | undefined | null) ||
    'Відправка протягом 1–3 днів'

  const selectedColorLabel = colorOptions.find(
    (option) => option.key === selectedColorKey,
  )?.label

  const hasAdvancedConfigurator = useMemo(
    () =>
      p.variants.some(
        (variant) =>
          (variant.straps?.length ?? 0) > 0 ||
          (variant.pouches?.length ?? 0) > 0 ||
          (variant.sizes?.length ?? 0) > 0,
      ),
    [p.variants],
  )

  const simpleSwatchEntries = useMemo(() => {
    if (hasAdvancedConfigurator) return []

    return colorOptions
      .map((option) => {
        const pick = choosePreferredVariant(
          p.variants.filter(
            (variant) => toOptionKey(variant.color) === option.key,
          ),
        )
        if (!pick) return null

        return {
          key: option.key,
          variant: pick,
          hex: option.hex ?? pick.hex ?? null,
        }
      })
      .filter(
        (
          entry,
        ): entry is {
          key: string
          variant: ProductWithVariants['variants'][number]
          hex: string | null
        } => Boolean(entry),
      )
  }, [colorOptions, hasAdvancedConfigurator, p.variants])

  const selectedSimpleVariantId = useMemo(() => {
    const selected = simpleSwatchEntries.find(
      (entry) => entry.key === selectedColorKey,
    )
    return selected?.variant.id ?? simpleSwatchEntries[0]?.variant.id ?? ''
  }, [selectedColorKey, simpleSwatchEntries])

  const requiresSizeSelection = sizeOptions.length > 0
  const requiresPouchSelection = pouchOptions.length > 0
  const requiresStrapSelection = strapOptions.length > 0

  const isStepColorDone = Boolean(selectedColorKey)
  const isStepSizeDone = !requiresSizeSelection || Boolean(selectedSizeId)
  const isStepPouchDone = !requiresPouchSelection || Boolean(selectedPouchId)
  const isStepStrapDone = !requiresStrapSelection || Boolean(strapId)

  const showSizeStepBlock = isStepColorDone && requiresSizeSelection
  const showPouchStepBlock =
    isStepColorDone && isStepSizeDone && requiresPouchSelection
  const showStrapStepBlock =
    isStepColorDone &&
    isStepSizeDone &&
    isStepPouchDone &&
    requiresStrapSelection

  const isConfigurationComplete =
    isStepColorDone && isStepSizeDone && isStepPouchDone && isStepStrapDone
  const canSubmitSelection = hasAdvancedConfigurator
    ? isConfigurationComplete
    : Boolean(v?.id)

  const stepIds = useMemo(() => {
    const ids = ['color']
    if (requiresSizeSelection) ids.push('size')
    if (requiresPouchSelection) ids.push('pouch')
    if (requiresStrapSelection) ids.push('strap')
    return ids
  }, [requiresSizeSelection, requiresPouchSelection, requiresStrapSelection])

  const completedSteps = stepIds.reduce((sum, id) => {
    if (id === 'color' && isStepColorDone) return sum + 1
    if (id === 'size' && isStepSizeDone) return sum + 1
    if (id === 'pouch' && isStepPouchDone) return sum + 1
    if (id === 'strap' && isStepStrapDone) return sum + 1
    return sum
  }, 0)

  const totalSteps = stepIds.length
  const progressPercent =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 100

  const stepNumberById = useMemo(() => {
    const map = new Map<string, number>()
    stepIds.forEach((id, index) => {
      map.set(id, index + 1)
    })
    return map
  }, [stepIds])

  const viewContentName = buildVariantSelectionLabel({
    productName: p.name,
    color: v?.color ?? null,
    size: selectedSize?.size ?? null,
    pouchColor: selectedPouch?.color ?? null,
  })

  const viewedKeyRef = useRef<string>('')
  useEffect(() => {
    if (!v) return

    const contentId = v.id
    const key = `${p.id}:${contentId}:${selectedSizeId ?? ''}:${selectedPouchId ?? ''}:${strapId ?? ''}`

    if (viewedKeyRef.current === key) return
    viewedKeyRef.current = key

    pushMetaViewContent({
      contentId,
      contentName: viewContentName,
      value: finalPriceWithOptionsUAH,
      productId: p.id,
      variantId: v.id,
      slug: p.slug,
    })
  }, [
    p.id,
    p.slug,
    v,
    selectedSizeId,
    selectedPouchId,
    strapId,
    finalPriceWithOptionsUAH,
    viewContentName,
  ])

  const galleryImages = useMemo(() => {
    if (!v) return ['/img/placeholder.png']

    const base: string[] = []
    const seen = new Set<string>()

    if (Array.isArray(v.images) && v.images.length > 0) {
      ;[...v.images]
        .sort((a, b) => a.sort - b.sort)
        .forEach((img) => {
          const url = img.url?.trim()
          if (!url || seen.has(url)) return
          seen.add(url)
          base.push(url)
        })
    }

    if (v.image) {
      const url = v.image.trim()
      if (url && !seen.has(url)) {
        seen.add(url)
        base.push(url)
      }
    }

    if (!base.length) base.push('/img/placeholder.png')

    const strapFirst = collectOptionImages(selectedStrap)
    const pouchSecond = collectOptionImages(selectedPouch)
    const sizeThird = collectOptionImages(selectedSize)

    if (!strapFirst.length && !pouchSecond.length && !sizeThird.length)
      return base

    const merged: string[] = []
    const mergedSeen = new Set<string>()

    for (const url of [...strapFirst, ...pouchSecond, ...sizeThird, ...base]) {
      if (!url || mergedSeen.has(url)) continue
      mergedSeen.add(url)
      merged.push(url)
    }

    return merged.length ? merged : base
  }, [v, selectedStrap, selectedPouch, selectedSize])

  const handleAddToCart = () => {
    if (!v || !canSubmitSelection) return

    add({
      productId: p.id,
      variantId: v.id,
      name: viewContentName,
      color: v.color ?? null,
      modelSize: selectedSize?.size ?? null,
      pouchColor: selectedPouch?.color ?? null,
      priceUAH: finalPriceWithOptionsUAH,
      image: galleryImages[0],
      qty: 1,
      slug: p.slug,
      strapId: selectedStrap?.id ?? null,
      strapName: selectedStrap?.name ?? null,
      sizeId: selectedSize?.id ?? null,
      pouchId: selectedPouch?.id ?? null,
    })

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
        color: addonV.color ?? null,
        modelSize: null,
        pouchColor: null,
        priceUAH: addonPrice(addonV),
        image: addonImageUrl(addonV) || galleryImages[0],
        qty: 1,
        slug: addonV.product.slug,
        strapId: null,
        strapName: null,
        sizeId: null,
        pouchId: null,
      })
    })

    openCart()
  }

  return (
    <>
      <section className="mx-auto flex flex-col items-center md:items-stretch md:flex-row md:justify-between gap-4 md:gap-10 mb-[60px] ">
        <div className="relative w-full md:w-[66%] h-[420px] md:h-[580px]">
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${
              galleryReady ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <ProductGalleryFallback src={galleryImages[0]} />
          </div>
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${
              galleryReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <ProductGallery images={galleryImages} />
          </div>
        </div>

        <div className="flex flex-col items-start w-full lg:w-[33%] pt-7 md:pt-0">
          <h1 className=" md:text-[38px] text-2xl font-fixel-display font-medium md:mb-6 mb-3">
            {p.name}
          </h1>

          <div className="mb-1">
            <div className="flex items-baseline gap-2">
              <div className="text-lg md:text-2xl">
                {finalPriceWithOptionsUAH} ₴
              </div>
              {hasDiscount && (
                <>
                  <div className="text-sm md:text-lg text-gray-500 line-through">
                    {basePriceWithOptionsUAH} ₴
                  </div>
                  <span className="text-[10px] md:text-xs border  rounded-full px-2 py-0.5 self-center text-white bg-[#DE2222]  ">
                    -{discountPercent}%
                  </span>
                </>
              )}
            </div>
            {hasDiscount && p.offerNote?.trim() && (
              <div className="text-[11px] md:text-xs text-gray-600 mt-1">
                {p.offerNote.trim()}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm mb-3">
            <span
              className={`inline-block h-2 w-2 rounded-full flex-none ${
                variantInStock
                  ? 'bg-green-500'
                  : variantPreorder
                    ? 'bg-red-500'
                    : 'bg-gray-300'
              }`}
            />
            <span
              className={
                variantInStock
                  ? 'text-green-700'
                  : variantPreorder
                    ? 'text-red-600'
                    : 'text-gray-500'
              }
            >
              {variantInStock
                ? 'Є в наявності'
                : variantPreorder
                  ? 'Відкрито передзамовлення (7–14 робочих днів). Залиште контакт — ми напишемо вам.'
                  : 'Немає в наявності'}
            </span>
          </div>

          <div className="w-full border-t border-gray-200 mb-3" />

          {p.variants.length > 0 && (
            <>
              {hasAdvancedConfigurator ? (
                <>
                  <div className="w-full rounded-xl border border-gray-200 p-3 md:p-4 mb-4 bg-white">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-gray-900 uppercase tracking-wide">
                        Конструктор
                      </div>
                      <div className="text-xs text-gray-600">
                        Крок {completedSteps} з {totalSteps}
                      </div>
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden mb-4">
                      <div
                        className="h-full bg-green-500 transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                          Крок {stepNumberById.get('color')}: Загальний колір
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {colorOptions.map((option) => {
                            const isActive = selectedColorKey === option.key
                            const outOfStock = option.rank === 2

                            return (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => {
                                  if (isColorLockedByEntry)
                                    setIsColorLockedByEntry(false)
                                  setSelectedColorKey(option.key)
                                }}
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition cursor-pointer ${
                                  isActive
                                    ? 'border-black bg-black text-white'
                                    : outOfStock
                                      ? 'border-gray-300 bg-white text-gray-500'
                                      : 'border-gray-300 bg-white text-gray-900 hover:border-black'
                                }`}
                              >
                                {option.hex ? (
                                  <span
                                    className="h-4 w-4 rounded-full border border-black/10"
                                    style={{ backgroundColor: option.hex }}
                                    aria-hidden
                                  />
                                ) : null}
                                <span>{option.label}</span>
                              </button>
                            )
                          })}
                        </div>
                        {isColorLockedByEntry && (
                          <div className="mt-2 text-xs text-gray-500">
                            Початковий колір із каталогу:{' '}
                            {selectedColorLabel || '—'}
                          </div>
                        )}
                      </div>

                      {showSizeStepBlock && (
                        <div>
                          <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                            Крок {stepNumberById.get('size')}: Розмір
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {sizeOptions.map((size) => {
                              const isActive = size.id === selectedSizeId
                              const extra = Math.max(
                                0,
                                Number(size.extraPriceUAH ?? 0),
                              )

                              return (
                                <button
                                  key={size.id}
                                  type="button"
                                  onClick={() => setSelectedSizeId(size.id)}
                                  className={`rounded-full border px-3 py-1.5 text-xs transition cursor-pointer ${
                                    isActive
                                      ? 'border-black bg-black text-white'
                                      : 'border-gray-300 bg-white text-gray-900 hover:border-black'
                                  }`}
                                >
                                  {size.size}
                                  {extra > 0 ? ` (+${extra} грн)` : ''}
                                </button>
                              )
                            })}
                          </div>
                          {!selectedSizeId && (
                            <div className="mt-2 text-xs text-red-600">
                              Оберіть розмір, щоб продовжити.
                            </div>
                          )}
                        </div>
                      )}

                      {showPouchStepBlock && (
                        <div>
                          <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                            Крок {stepNumberById.get('pouch')}: Колір мішечка
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {pouchOptions.map((pouch) => {
                              const isActive = pouch.id === selectedPouchId
                              const extra = Math.max(
                                0,
                                Number(pouch.extraPriceUAH ?? 0),
                              )

                              return (
                                <button
                                  key={pouch.id}
                                  type="button"
                                  onClick={() => setSelectedPouchId(pouch.id)}
                                  className={`rounded-full border px-3 py-1.5 text-xs transition cursor-pointer ${
                                    isActive
                                      ? 'border-black bg-black text-white'
                                      : 'border-gray-300 bg-white text-gray-900 hover:border-black'
                                  }`}
                                >
                                  {pouch.color}
                                  {extra > 0 ? ` (+${extra} грн)` : ''}
                                </button>
                              )
                            })}
                          </div>
                          {!selectedPouchId && (
                            <div className="mt-2 text-xs text-red-600">
                              Оберіть колір мішечка, щоб продовжити.
                            </div>
                          )}
                        </div>
                      )}

                      {showStrapStepBlock && (
                        <div>
                          <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                            Крок {stepNumberById.get('strap')}: Ремінець
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {strapOptions.map((strap) => {
                              const isActive = strap.id === strapId
                              const extra = Math.max(
                                0,
                                Number(strap.extraPriceUAH ?? 0),
                              )

                              return (
                                <button
                                  key={strap.id}
                                  type="button"
                                  onClick={() => setStrapId(strap.id)}
                                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition cursor-pointer ${
                                    isActive
                                      ? 'border-black bg-black text-white'
                                      : 'border-gray-300 bg-white text-gray-900 hover:border-black'
                                  }`}
                                >
                                  {strap.imageUrl ? (
                                    <span className="relative w-5 h-5 rounded-full overflow-hidden bg-gray-100">
                                      <Image
                                        src={strap.imageUrl}
                                        alt={strap.name}
                                        fill
                                        className="object-cover"
                                      />
                                    </span>
                                  ) : null}
                                  <span>
                                    {strap.name}
                                    {extra > 0 ? ` (+${extra} грн)` : ''}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                          {!strapId && (
                            <div className="mt-2 text-xs text-red-600">
                              Оберіть ремінець, щоб продовжити.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-4 w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                    <div className="font-medium text-gray-900 mb-1">
                      Ваш вибір:
                    </div>
                    {v?.color && <div>Колір: {v.color}</div>}
                    {selectedSize?.size && (
                      <div>Розмір: {selectedSize.size}</div>
                    )}
                    {selectedPouch?.color && (
                      <div>Колір мішечка: {selectedPouch.color}</div>
                    )}
                    {selectedStrap?.name && (
                      <div>Ремінець: {selectedStrap.name}</div>
                    )}
                    {/*  {!isConfigurationComplete && (
                      <div className="mt-1 text-red-600">
                        Завершіть кроки в конструкторі, щоб додати товар в кошик.
                      </div>
                    )} */}
                  </div>
                </>
              ) : (
                simpleSwatchEntries.length > 1 && (
                  <div className="mb-4 w-full">
                    <div className="mb-2 flex items-center gap-2 text-sm text-gray-600">
                      <span>Колір:</span>
                      {v?.color && (
                        <span className="font-medium text-gray-900">
                          {v.color}
                        </span>
                      )}
                    </div>
                    <VariantSwatches
                      variants={simpleSwatchEntries.map((entry) => ({
                        id: entry.variant.id,
                        color: entry.variant.color ?? null,
                        hex: entry.hex ?? null,
                        inStock: entry.variant.inStock,
                        availabilityStatus: (entry.variant as any)
                          .availabilityStatus,
                      }))}
                      value={selectedSimpleVariantId}
                      onChange={(variantId) => {
                        const entry = simpleSwatchEntries.find(
                          (item) => item.variant.id === variantId,
                        )
                        if (!entry) return
                        if (isColorLockedByEntry) setIsColorLockedByEntry(false)
                        setSelectedColorKey(entry.key)
                      }}
                    />
                  </div>
                )
              )}

              {canSubmitSelection && (
                <AddonsSection
                  availableAddons={availableAddons}
                  selectedAddonVariantIds={selectedAddonVariantIds}
                  toggleAddon={toggleAddon}
                  addonPricing={addonPricing}
                  addonImageUrl={addonImageUrl}
                  addonsTotal={addonsTotal}
                />
              )}
            </>
          )}

          <ProductActions
            availabilityStatus={availabilityStatus}
            canSubmit={canSubmitSelection}
            onAddToCart={handleAddToCart}
            onPreorder={() => {
              if (variantPreorder && canSubmitSelection) openPreorder()
            }}
          />

          {preorderOpen && variantPreorder && (
            <PreorderModal
              open={preorderOpen}
              status={preorderStatus}
              productName={p.name}
              variantLabel={viewContentName || undefined}
              leadName={leadName}
              setLeadName={setLeadName}
              leadContact={leadContact}
              setLeadContact={setLeadContact}
              leadComment={leadComment}
              setLeadComment={setLeadComment}
              onClose={closePreorder}
              onSubmit={submitPreorder}
            />
          )}

          <ProductTabs
            description={p.description}
            info={p.info}
            dimensions={p.dimensions}
          />

          <div className="mt-8 space-y-3 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>{shippingNote}</span>
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

      <YouMayAlsoLike
        currentSlug={p.slug}
        currentId={p.id}
        currentType={p.type}
        currentGroup={p.group ?? undefined}
      />
    </>
  )
}
