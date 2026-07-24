'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import type { PreorderItemInput } from '@/lib/preorder'
import {
  calcLocalizedDiscountedPrice,
  convertOptionPriceFromUAH,
  formatLocalizedMoney,
  pickLocalizedText,
} from '@/lib/localized-product'
import ProductTabs from '@/components/product/ProductTabs'
import VariantSwatches from '@/components/product/VariantSwatches'
import {
  isInStockStatus,
  isPreorderStatus,
  resolveAvailabilityStatus,
} from '@/lib/availability'
import { useLocale, useLocaleNumberFormat, useT } from '@/lib/i18n'
import {
  InstagramIcon,
  ThreadsIcon,
  TikTokIcon,
} from '@/components/icons/SocialIcons'
import {
  availabilityRank,
  buildVariantSelectionLabel,
  choosePreferredVariant,
  collectOptionImages,
  getVariantIdFromHash,
  getVariantIdFromLocation,
  optionPreviewImage,
  resolveOptionSwatchColor,
  toOptionKey,
  toOptionLabel,
  type CustomizationGalleryTarget,
} from './product-options'

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

function ProductGalleryFallback({ src }: { src: string }) {
  const t = useT()
  return (
    <div className="relative w-full">
      <div className="relative md:h-[420px] md:h-[580px] w-full overflow-hidden rounded bg-white">
        <Image
          src={src}
          alt={t('Фото товару', 'Product image')}
          fill
          className="object-cover"
          priority
          sizes="(min-width: 1024px) 66vw, 100vw"
        />
      </div>
    </div>
  )
}

function ColorOptionButton(props: {
  label: string
  selected: boolean
  color: string | null
  imageUrl?: string | null
  extraLabel?: string
  onClick: () => void
}) {
  const title = `${props.label}${props.extraLabel || ''}`

  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.selected}
      aria-label={title}
      title={title}
      onClick={props.onClick}
      className={`relative grid h-10 w-10 place-items-center rounded-full border bg-white p-1 transition cursor-pointer ${
        props.selected
          ? 'border-black ring-2 ring-black/10'
          : 'border-gray-300 hover:border-black'
      }`}
    >
      <span className="relative h-full w-full overflow-hidden rounded-full border border-black/10 bg-gray-200">
        {props.color ? (
          <span
            className="absolute inset-0"
            style={{ backgroundColor: props.color }}
            aria-hidden
          />
        ) : props.imageUrl ? (
          <Image
            src={props.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="28px"
          />
        ) : (
          <span
            className="absolute inset-0 bg-[linear-gradient(135deg,#f8fafc_0%,#d1d5db_100%)]"
            aria-hidden
          />
        )}
      </span>
      {props.extraLabel ? (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-white bg-black"
          aria-hidden
        />
      ) : null}
    </button>
  )
}

export function ProductInteractive({ p }: { p: ProductWithVariants }) {
  const locale = useLocale()
  const numberLocale = useLocaleNumberFormat()
  const t = useT()
  const productName = pickLocalizedText(p.name, (p as any).nameEn, locale)
  const [selectedColorKey, setSelectedColorKey] = useState<string | undefined>()
  const [selectedVariantId, setSelectedVariantId] = useState<
    string | undefined
  >()
  const [isColorLockedByEntry, setIsColorLockedByEntry] = useState(false)
  const [selectedSizeId, setSelectedSizeId] = useState<string | undefined>()
  const [selectedPouchId, setSelectedPouchId] = useState<string | undefined>()
  const [strapId, setStrapId] = useState<string | undefined>()
  const [activeCustomizationImage, setActiveCustomizationImage] =
    useState<CustomizationGalleryTarget | null>(null)
  const [galleryReady, setGalleryReady] = useState(false)
  const selectedVariantIdRef = useRef<string | undefined>(undefined)
  const selectedColorKeyRef = useRef<string | undefined>(undefined)

  const openCart = useUI((s) => s.openCart)
  const add = useCart((s) => s.add)

  useEffect(() => {
    selectedVariantIdRef.current = selectedVariantId
  }, [selectedVariantId])

  useEffect(() => {
    selectedColorKeyRef.current = selectedColorKey
  }, [selectedColorKey])

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
      const localizedColor = pickLocalizedText(
        variant.color,
        (variant as any).colorEn,
        locale,
      )
      const key = toOptionKey(localizedColor)
      const existing = map.get(key)
      const rank = availabilityRank(variant)
      const sort =
        typeof variant.sortCatalog === 'number' ? variant.sortCatalog : 0

      if (!existing) {
        map.set(key, {
          key,
          label: toOptionLabel(
            localizedColor,
            locale === 'en' ? 'Base' : 'Базовий',
          ),
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
  }, [locale, p.variants])

  const variantsByColor = useMemo(() => {
    if (!selectedColorKey) return p.variants
    return p.variants.filter(
      (variant) =>
        toOptionKey(
          pickLocalizedText(variant.color, (variant as any).colorEn, locale),
        ) === selectedColorKey,
    )
  }, [locale, p.variants, selectedColorKey])

  const selectedVariant = useMemo(
    () =>
      selectedVariantId
        ? p.variants.find((variant) => variant.id === selectedVariantId) || null
        : null,
    [p.variants, selectedVariantId],
  )

  const v = useMemo(
    () =>
      selectedVariant ||
      choosePreferredVariant(variantsByColor) ||
      choosePreferredVariant(p.variants) ||
      null,
    [selectedVariant, variantsByColor, p.variants],
  )

  const pickPreferredVariantForColorKey = useCallback(
    (colorKey: string) =>
      choosePreferredVariant(
        p.variants.filter(
          (variant) =>
            toOptionKey(
              pickLocalizedText(
                variant.color,
                (variant as any).colorEn,
                locale,
              ),
            ) === colorKey,
        ),
      ),
    [locale, p.variants],
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!p.variants?.length) return

    const syncFromUrl = () => {
      const requestedVariantId = getVariantIdFromLocation(window.location)
      const requestedVariant = requestedVariantId
        ? p.variants.find((variant) => variant.id === requestedVariantId) ||
          null
        : null

      const nextVariant = requestedVariant || choosePreferredVariant(p.variants)
      if (!nextVariant) return

      const nextColorKey = toOptionKey(
        pickLocalizedText(
          nextVariant.color,
          (nextVariant as any).colorEn,
          locale,
        ),
      )
      const changed = selectedVariantIdRef.current !== nextVariant.id
      if (changed) {
        setSelectedSizeId(undefined)
        setSelectedPouchId(undefined)
        setStrapId(undefined)
        setActiveCustomizationImage(null)
      }
      if (selectedVariantIdRef.current !== nextVariant.id) {
        selectedVariantIdRef.current = nextVariant.id
        setSelectedVariantId(nextVariant.id)
      }
      if (selectedColorKeyRef.current !== nextColorKey) {
        selectedColorKeyRef.current = nextColorKey
        setSelectedColorKey(nextColorKey)
      }
      setIsColorLockedByEntry(Boolean(requestedVariant))
    }

    syncFromUrl()
    window.addEventListener('popstate', syncFromUrl)
    window.addEventListener('hashchange', syncFromUrl)

    return () => {
      window.removeEventListener('popstate', syncFromUrl)
      window.removeEventListener('hashchange', syncFromUrl)
    }
  }, [locale, p.variants])

  useEffect(() => {
    if (!colorOptions.length) return

    const currentColorKey = selectedColorKeyRef.current
    if (!currentColorKey) return

    const exists = colorOptions.some((option) => option.key === currentColorKey)
    if (exists) return

    const fallbackKey = colorOptions[0].key
    selectedColorKeyRef.current = fallbackKey
    setSelectedColorKey(fallbackKey)
  }, [colorOptions])

  useEffect(() => {
    if (!selectedColorKey) return

    const stillValid =
      selectedVariantId &&
      variantsByColor.some((variant) => variant.id === selectedVariantId)
    if (stillValid) return

    const preferred = choosePreferredVariant(variantsByColor)
    const nextId = preferred?.id
    if (selectedVariantId !== nextId) {
      selectedVariantIdRef.current = nextId
      setSelectedVariantId(nextId)
    }
  }, [selectedColorKey, selectedVariantId, variantsByColor])

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
    if (selectedVariantIdRef.current && selectedVariantIdRef.current !== v.id) {
      return
    }

    const url = new URL(window.location.href)
    const current =
      url.searchParams.get('variant') || getVariantIdFromHash(url.hash) || ''
    if (current === v.id && url.searchParams.get('variant') === v.id) return

    url.searchParams.set('variant', v.id)
    if (url.hash.startsWith('#variant=')) {
      url.hash = ''
    }

    const next = `${url.pathname}?${url.searchParams.toString()}${url.hash}`
    window.history.replaceState(window.history.state, '', next)
  }, [v?.id])

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
  const referencePriceUAH = v?.priceUAH ?? p.basePriceUAH ?? 0
  const referencePriceUSD =
    (v as any)?.priceUSD ?? (p as any).basePriceUSD ?? null

  const { basePrice, finalPrice, hasDiscount, discountPercent, currency } =
    calcLocalizedDiscountedPrice({
      locale,
      priceUAH: referencePriceUAH,
      priceUSD: referencePriceUSD,
      discountPercent: v?.discountPercent,
      discountUAH: v?.discountUAH ?? 0,
    })
  const { basePrice: basePriceUAH, finalPrice: finalPriceUAH } =
    calcLocalizedDiscountedPrice({
      locale: 'uk',
      priceUAH: referencePriceUAH,
      discountPercent: v?.discountPercent,
      discountUAH: v?.discountUAH ?? 0,
    })
  const usdPricing = calcLocalizedDiscountedPrice({
    locale: 'en',
    priceUAH: referencePriceUAH,
    priceUSD: referencePriceUSD,
    discountPercent: v?.discountPercent,
    discountUAH: v?.discountUAH ?? 0,
  })

  const extraTotalUAH =
    selectedSizeExtraPriceUAH +
    selectedPouchExtraPriceUAH +
    selectedStrapExtraPriceUAH
  const selectedSizeExtraPriceUSD =
    convertOptionPriceFromUAH({
      extraPriceUAH: selectedSize?.extraPriceUAH,
      targetCurrency: 'USD',
      referencePriceUAH,
      referencePriceUSD,
    }) ?? 0
  const selectedPouchExtraPriceUSD =
    convertOptionPriceFromUAH({
      extraPriceUAH: selectedPouch?.extraPriceUAH,
      targetCurrency: 'USD',
      referencePriceUAH,
      referencePriceUSD,
    }) ?? 0
  const selectedStrapExtraPriceUSD =
    convertOptionPriceFromUAH({
      extraPriceUAH: selectedStrap?.extraPriceUAH,
      targetCurrency: 'USD',
      referencePriceUAH,
      referencePriceUSD,
    }) ?? 0
  const extraTotalUSD =
    selectedSizeExtraPriceUSD +
    selectedPouchExtraPriceUSD +
    selectedStrapExtraPriceUSD

  const basePriceWithOptionsUAH = basePriceUAH + extraTotalUAH
  const finalPriceWithOptionsUAH = finalPriceUAH + extraTotalUAH
  const basePriceWithOptionsUSD =
    usdPricing.currency === 'USD' ? usdPricing.basePrice + extraTotalUSD : null
  const finalPriceWithOptionsUSD =
    usdPricing.currency === 'USD' ? usdPricing.finalPrice + extraTotalUSD : null
  const basePriceWithOptions =
    currency === 'USD'
      ? (basePriceWithOptionsUSD ?? basePriceWithOptionsUAH)
      : basePriceWithOptionsUAH
  const finalPriceWithOptions =
    currency === 'USD'
      ? (finalPriceWithOptionsUSD ?? finalPriceWithOptionsUAH)
      : finalPriceWithOptionsUAH
  const finalPriceUSDForCart =
    usdPricing.currency === 'USD' ? finalPriceWithOptionsUSD : null
  const finalPriceLabel = formatLocalizedMoney(
    finalPriceWithOptions,
    currency,
    numberLocale,
  )
  const basePriceLabel = formatLocalizedMoney(
    basePriceWithOptions,
    currency,
    numberLocale,
  )

  const shippingNote =
    ((v as any)?.shippingNote as string | undefined | null) ||
    t('Відправка день у день', 'Ships within 1 business day')
  const offerNote = pickLocalizedText(
    p.offerNote,
    (p as any).offerNoteEn,
    locale,
  )
  const selectedVariantColor = pickLocalizedText(
    v?.color,
    (v as any)?.colorEn,
    locale,
  )
  const formatOptionExtraLabel = (extraPriceUAH: number | null | undefined) => {
    const extra = convertOptionPriceFromUAH({
      extraPriceUAH,
      targetCurrency: currency,
      referencePriceUAH,
      referencePriceUSD,
    })
    if (!extra) return ''
    return ` (+${formatLocalizedMoney(extra, currency, numberLocale)})`
  }

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
            (variant) =>
              toOptionKey(
                pickLocalizedText(
                  variant.color,
                  (variant as any).colorEn,
                  locale,
                ),
              ) === option.key,
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
  }, [colorOptions, hasAdvancedConfigurator, locale, p.variants])

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

  const showPouchStepBlock = isStepColorDone && requiresPouchSelection
  const showStrapStepBlock =
    isStepColorDone && isStepPouchDone && requiresStrapSelection
  const showSizeStepBlock =
    isStepColorDone &&
    isStepPouchDone &&
    isStepStrapDone &&
    requiresSizeSelection

  const isConfigurationComplete =
    isStepColorDone && isStepSizeDone && isStepPouchDone && isStepStrapDone
  const canSubmitSelection = hasAdvancedConfigurator
    ? isConfigurationComplete
    : Boolean(v?.id)

  const stepIds = useMemo(() => {
    const ids = ['color']
    if (requiresPouchSelection) ids.push('pouch')
    if (requiresStrapSelection) ids.push('strap')
    if (requiresSizeSelection) ids.push('size')
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

  const selectedPouchStepLabel = selectedPouch?.color?.trim()
    ? `${selectedPouch.color.trim()}${formatOptionExtraLabel(
        selectedPouch.extraPriceUAH,
      )}`
    : t('Оберіть колір мішечка', 'Choose pouch color')
  const selectedStrapStepLabel = selectedStrap?.name?.trim()
    ? `${selectedStrap.name.trim()}${formatOptionExtraLabel(
        selectedStrap.extraPriceUAH,
      )}`
    : t('Оберіть колір ремінця', 'Choose strap color')

  const viewContentName = buildVariantSelectionLabel({
    productName,
    color: selectedVariantColor,
    size: selectedSize?.size ?? null,
    pouchColor: selectedPouch?.color ?? null,
    locale,
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

    const optionImagesByTarget: Record<CustomizationGalleryTarget, string[]> = {
      pouch: collectOptionImages(selectedPouch),
      strap: collectOptionImages(selectedStrap),
      size: collectOptionImages(selectedSize),
    }
    const defaultOrder: CustomizationGalleryTarget[] = [
      'pouch',
      'strap',
      'size',
    ]
    const orderedTargets = activeCustomizationImage
      ? [
          activeCustomizationImage,
          ...defaultOrder.filter(
            (target) => target !== activeCustomizationImage,
          ),
        ]
      : defaultOrder
    const optionImages = orderedTargets.flatMap(
      (target) => optionImagesByTarget[target],
    )

    if (!optionImages.length) return base

    const merged: string[] = []
    const mergedSeen = new Set<string>()

    for (const url of [...optionImages, ...base]) {
      if (!url || mergedSeen.has(url)) continue
      mergedSeen.add(url)
      merged.push(url)
    }

    return merged.length ? merged : base
  }, [v, selectedStrap, selectedPouch, selectedSize, activeCustomizationImage])

  const selectedAddonProducts = useMemo(
    () =>
      selectedAddonVariantIds
        .map((addonVariantId) => {
          const addonV = addonsByVariantId[addonVariantId]
          if (!addonV) return null

          const addonProductName = pickLocalizedText(
            addonV.product.name,
            (addonV.product as any).nameEn,
            locale,
          )
          const addonColor = pickLocalizedText(
            addonV.color,
            (addonV as any).colorEn,
            locale,
          )
          const name = `${addonProductName}${addonColor ? ` — ${addonColor}` : ''}`
          const addonUsdPricing = calcLocalizedDiscountedPrice({
            locale: 'en',
            priceUAH: addonV.priceUAH ?? addonV.product.basePriceUAH ?? 0,
            priceUSD:
              (addonV as any).priceUSD ??
              (addonV.product as any).basePriceUSD ??
              null,
            discountPercent: addonV.discountPercent,
            discountUAH: addonV.discountUAH ?? 0,
          })

          return {
            productId: addonV.product.id,
            variantId: addonV.id,
            productName: addonProductName,
            name,
            color: addonColor || null,
            priceUAH: addonPrice(addonV),
            priceUSD:
              addonUsdPricing.currency === 'USD'
                ? addonUsdPricing.finalPrice
                : null,
            image: addonImageUrl(addonV) || galleryImages[0],
            slug: addonV.product.slug,
          }
        })
        .filter(
          (
            addon,
          ): addon is {
            productId: string
            variantId: string
            productName: string
            name: string
            color: string | null
            priceUAH: number
            priceUSD: number | null
            image: string
            slug: string
          } => Boolean(addon),
        ),
    [
      addonImageUrl,
      addonPrice,
      addonsByVariantId,
      galleryImages,
      locale,
      selectedAddonVariantIds,
    ],
  )

  const preorderItems = useMemo<PreorderItemInput[]>(() => {
    if (!v || !canSubmitSelection) return []

    return [
      {
        kind: 'main',
        productId: p.id,
        productSlug: p.slug,
        productName,
        variantId: v.id,
        variantLabel: viewContentName,
        variantColor: selectedVariantColor || null,
        modelSize: selectedSize?.size ?? null,
        pouchColor: selectedPouch?.color ?? null,
        strapId: selectedStrap?.id ?? strapId ?? null,
        strapName: selectedStrap?.name ?? null,
        priceUAH: finalPriceWithOptionsUAH,
        qty: 1,
        image: galleryImages[0] ?? null,
      },
      ...selectedAddonProducts.map((addon) => ({
        kind: 'addon' as const,
        productId: addon.productId,
        productSlug: addon.slug,
        productName: addon.productName,
        variantId: addon.variantId,
        variantLabel: addon.name,
        variantColor: addon.color,
        priceUAH: addon.priceUAH,
        qty: 1,
        image: addon.image,
      })),
    ]
  }, [
    canSubmitSelection,
    finalPriceWithOptionsUAH,
    galleryImages,
    p.id,
    p.slug,
    productName,
    selectedAddonProducts,
    selectedPouch?.color,
    selectedSize?.size,
    selectedStrap?.id,
    selectedStrap?.name,
    selectedVariantColor,
    strapId,
    v,
    viewContentName,
  ])

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
  } = usePreorder({ product: p, variant: v, strapId, items: preorderItems })

  const handleAddToCart = () => {
    if (!v || !canSubmitSelection) return

    add({
      productId: p.id,
      variantId: v.id,
      name: viewContentName,
      color: selectedVariantColor || null,
      modelSize: selectedSize?.size ?? null,
      pouchColor: selectedPouch?.color ?? null,
      priceUAH: finalPriceWithOptionsUAH,
      priceUSD: finalPriceUSDForCart,
      image: galleryImages[0],
      qty: 1,
      slug: p.slug,
      strapId: selectedStrap?.id ?? null,
      strapName: selectedStrap?.name ?? null,
      sizeId: selectedSize?.id ?? null,
      pouchId: selectedPouch?.id ?? null,
    })

    selectedAddonProducts.forEach((addon) => {
      add({
        productId: addon.productId,
        variantId: addon.variantId,
        name: addon.name,
        color: addon.color,
        modelSize: null,
        pouchColor: null,
        priceUAH: addon.priceUAH,
        priceUSD: addon.priceUSD,
        image: addon.image,
        qty: 1,
        slug: addon.slug,
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
            <ProductGallery
              images={galleryImages}
              onReady={() => setGalleryReady(true)}
            />
          </div>
        </div>

        <div className="flex flex-col items-start w-full lg:w-[33%] pt-7 md:pt-0">
          <h1 className=" md:text-[38px] text-2xl font-fixel-display font-medium md:mb-6 mb-3">
            {productName}
          </h1>

          <div className="mb-1">
            <div className="flex items-baseline gap-2">
              <div className="text-lg md:text-2xl">{finalPriceLabel}</div>
              {hasDiscount && (
                <>
                  <div className="text-sm md:text-lg text-gray-500 line-through">
                    {basePriceLabel}
                  </div>
                  <span className="text-[10px] md:text-xs border  rounded-full px-2 py-0.5 self-center text-white bg-[#DE2222]  ">
                    -{discountPercent}%
                  </span>
                </>
              )}
            </div>
            {hasDiscount && offerNote && (
              <div className="text-[11px] md:text-xs text-gray-600 mt-1">
                {offerNote}
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
                ? t('Є в наявності', 'In stock')
                : variantPreorder
                  ? t(
                      'Відкрите передзамовлення. Виготовлення до 7 робочих днів. Залиште контакт — ми надішлемо вам деталі.',
                      'Pre-order is open 7 business days. Leave contact details and we will reach out.',
                    )
                  : t('Немає в наявності', 'Out of stock')}
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
                        {t('Кастомізація', 'Configurator')}
                      </div>
                      <div className="text-xs text-gray-600">
                        {t('Крок', 'Step')} {completedSteps} {t('з', 'of')}{' '}
                        {totalSteps}
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
                        <div className="mb-2 text-sm uppercase tracking-wide text-gray-900">
                          {t('Крок', 'Step')} {stepNumberById.get('color')}:{' '}
                          {t('Колір', 'Color')}
                        </div>
                        {selectedColorLabel ? (
                          <div className="mt-1 mb-2 min-h-5 text-xs font-medium text-gray-500">
                            {selectedColorLabel}
                          </div>
                        ) : null}
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
                                  setSelectedSizeId(undefined)
                                  setSelectedPouchId(undefined)
                                  setStrapId(undefined)
                                  setActiveCustomizationImage(null)
                                  const nextId =
                                    pickPreferredVariantForColorKey(
                                      option.key,
                                    )?.id
                                  selectedVariantIdRef.current = nextId
                                  setSelectedVariantId(nextId)
                                }}
                                aria-label={option.label}
                                title={option.label}
                                className={`relative grid h-10 w-10 place-items-center rounded-full border bg-white p-1 transition cursor-pointer ${
                                  isActive
                                    ? 'border-black ring-2 ring-black/10'
                                    : outOfStock
                                      ? 'border-gray-300 opacity-50'
                                      : 'border-gray-300 hover:border-black'
                                }`}
                              >
                                <span
                                  className="h-full w-full rounded-full border border-black/10 bg-gray-200"
                                  style={
                                    option.hex
                                      ? { backgroundColor: option.hex }
                                      : undefined
                                  }
                                  aria-hidden
                                />
                                {outOfStock ? (
                                  <span
                                    aria-hidden
                                    className="absolute inset-1 rounded-full"
                                    style={{
                                      background:
                                        'linear-gradient(135deg, transparent 47%, rgba(0,0,0,0.35) 47%, rgba(0,0,0,0.35) 53%, transparent 53%)',
                                    }}
                                  />
                                ) : null}
                              </button>
                            )
                          })}
                        </div>
                        {/* {isColorLockedByEntry && (
                          <div className="mt-2 text-sm text-gray-900">
                            {t(
                              'Початковий колір із каталогу',
                              'Initial color from catalog',
                            )}
                            : {selectedColorLabel || '—'}
                          </div>
                        )} */}
                      </div>

                      {showPouchStepBlock && (
                        <div>
                          <div className="mb-2">
                            <div className="text-sm uppercase tracking-wide text-gray-900">
                              {t('Крок', 'Step')} {stepNumberById.get('pouch')}:{' '}
                              {t('Колір мішечка', 'Pouch color')}
                            </div>
                            <div className="mt-1 min-h-5 text-sm font-medium text-gray-500">
                              {selectedPouchStepLabel}
                            </div>
                          </div>
                          <div
                            role="radiogroup"
                            aria-label={t('Колір мішечка', 'Pouch color')}
                            className="flex flex-wrap gap-2"
                          >
                            {pouchOptions.map((pouch) => {
                              const isActive = pouch.id === selectedPouchId
                              const extra = Math.max(
                                0,
                                Number(pouch.extraPriceUAH ?? 0),
                              )
                              const extraLabel =
                                extra > 0
                                  ? formatOptionExtraLabel(pouch.extraPriceUAH)
                                  : ''

                              return (
                                <ColorOptionButton
                                  key={pouch.id}
                                  label={pouch.color}
                                  selected={isActive}
                                  color={resolveOptionSwatchColor(pouch.color)}
                                  imageUrl={optionPreviewImage(pouch)}
                                  extraLabel={extraLabel}
                                  onClick={() => {
                                    setSelectedPouchId(pouch.id)
                                    setActiveCustomizationImage('pouch')
                                  }}
                                />
                              )
                            })}
                          </div>
                          {!selectedPouchId && (
                            <div className="mt-2 text-xs text-red-600">
                              {t(
                                'Оберіть колір мішечка, щоб продовжити.',
                                'Choose pouch color to continue.',
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {showStrapStepBlock && (
                        <div>
                          <div className="mb-2">
                            <div className="text-sm uppercase tracking-wide text-gray-900">
                              {t('Крок', 'Step')} {stepNumberById.get('strap')}:{' '}
                              {t('Колір ремінця', 'Strap color')}
                            </div>
                            {
                              <div className="mt-1 min-h-5 text-xs font-medium text-gray-500">
                                {selectedStrapStepLabel}
                              </div>
                            }
                          </div>
                          <div
                            role="radiogroup"
                            aria-label={t('Колір ремінця', 'Strap color')}
                            className="flex flex-wrap gap-2"
                          >
                            {strapOptions.map((strap) => {
                              const isActive = strap.id === strapId
                              const extra = Math.max(
                                0,
                                Number(strap.extraPriceUAH ?? 0),
                              )
                              const extraLabel =
                                extra > 0
                                  ? formatOptionExtraLabel(strap.extraPriceUAH)
                                  : ''

                              return (
                                <ColorOptionButton
                                  key={strap.id}
                                  label={strap.name}
                                  selected={isActive}
                                  color={resolveOptionSwatchColor(strap.name)}
                                  imageUrl={optionPreviewImage(strap)}
                                  extraLabel={extraLabel}
                                  onClick={() => {
                                    setStrapId(strap.id)
                                    setActiveCustomizationImage('strap')
                                  }}
                                />
                              )
                            })}
                          </div>
                          {!strapId && (
                            <div className="mt-2 text-xs text-red-600">
                              {t(
                                'Оберіть ремінець, щоб продовжити.',
                                'Choose strap to continue.',
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {showSizeStepBlock && (
                        <div>
                          <div className="mb-2 text-sm uppercase tracking-wide text-gray-900">
                            {t('Крок', 'Step')} {stepNumberById.get('size')}:{' '}
                            {t('Розмір', 'Size')}
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
                                  onClick={() => {
                                    setSelectedSizeId(size.id)
                                    setActiveCustomizationImage('size')
                                  }}
                                  className={`rounded-full border px-3 py-1.5 text-xs transition cursor-pointer ${
                                    isActive
                                      ? 'border-black bg-black text-white'
                                      : 'border-gray-300 bg-white text-gray-900 hover:border-black'
                                  }`}
                                >
                                  {size.size}
                                  {extra > 0
                                    ? formatOptionExtraLabel(size.extraPriceUAH)
                                    : ''}
                                </button>
                              )
                            })}
                          </div>
                          {!selectedSizeId && (
                            <div className="mt-2 text-xs text-red-600">
                              {t(
                                'Оберіть розмір, щоб продовжити.',
                                'Choose size to continue.',
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {/*
                  <div className="mb-4 w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                    <div className="font-medium text-gray-900 mb-1">
                      {t('Ваш вибір', 'Your selection')}:
                    </div>
                    {selectedVariantColor && (
                      <div>
                        {t('Колір', 'Color')}: {selectedVariantColor}
                      </div>
                    )}
                    {selectedSize?.size && (
                      <div>
                        {t('Розмір', 'Size')}: {selectedSize.size}
                      </div>
                    )}
                    {selectedPouch?.color && (
                      <div>
                        {t('Колір мішечка', 'Pouch color')}:{' '}
                        {selectedPouch.color}
                      </div>
                    )}
                    {selectedStrap?.name && (
                      <div>
                        {t('Ремінець', 'Strap')}: {selectedStrap.name}
                      </div>
                    )}
                    {}
                  </div> */}
                </>
              ) : (
                simpleSwatchEntries.length > 1 && (
                  <div className="mb-4 w-full">
                    <div className="mb-2 flex items-center gap-2 text-sm text-gray-600">
                      <span>{t('Колір', 'Color')}:</span>
                      {selectedVariantColor && (
                        <span className="font-medium text-gray-900">
                          {selectedVariantColor}
                        </span>
                      )}
                    </div>
                    <VariantSwatches
                      size="large"
                      variants={simpleSwatchEntries.map((entry) => ({
                        id: entry.variant.id,
                        color:
                          pickLocalizedText(
                            entry.variant.color,
                            (entry.variant as any).colorEn,
                            locale,
                          ) || null,
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
                        setSelectedSizeId(undefined)
                        setSelectedPouchId(undefined)
                        setStrapId(undefined)
                        setActiveCustomizationImage(null)
                        selectedVariantIdRef.current = entry.variant.id
                        setSelectedVariantId(entry.variant.id)
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
              productName={productName}
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
            description={pickLocalizedText(
              p.description,
              (p as any).descriptionEn,
              locale,
            )}
            info={pickLocalizedText(p.info, (p as any).infoEn, locale)}
            dimensions={pickLocalizedText(
              p.dimensions,
              (p as any).dimensionsEn,
              locale,
            )}
          />

          <div className="mt-6">
            <div className="text-[11px] uppercase tracking-[0.08em] text-gray-600">
              {t('Соцмережі', 'Socials')}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <a
                href="https://instagram.com/gerdan.studio"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black text-white bg-black transition hover:bg-white hover:text-black"
              >
                <InstagramIcon className="h-6 w-6" />
              </a>
              <a
                href="https://www.tiktok.com/@gerdan.studio"
                target="_blank"
                rel="noreferrer"
                aria-label="TikTok"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black text-white bg-black transition hover:bg-white hover:text-black"
              >
                <TikTokIcon className="h-6 w-6" />
              </a>
              <a
                href="https://www.threads.net/@gerdan.studio"
                target="_blank"
                rel="noreferrer"
                aria-label="Threads"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black text-white bg-black transition hover:bg-white hover:text-black"
              >
                <ThreadsIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="mt-8 space-y-3 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>{shippingNote}</span>
            </div>
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
