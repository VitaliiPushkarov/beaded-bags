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
import {
  calcLocalizedDiscountedPrice,
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

function getVariantIdFromLocation(loc: Location): string | undefined {
  const fromQuery = new URLSearchParams(loc.search).get('variant')
  return fromQuery || getVariantIdFromHash(loc.hash)
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

function buildVariantSelectionLabel(params: {
  productName: string
  color?: string | null
  size?: string | null
  pouchColor?: string | null
  locale: 'uk' | 'en'
}) {
  const isEn = params.locale === 'en'
  const parts = [
    params.color?.trim(),
    params.size?.trim()
      ? `${isEn ? 'Size' : 'Розмір'}: ${params.size.trim()}`
      : null,
    params.pouchColor?.trim()
      ? `${isEn ? 'Pouch' : 'Мішечок'}: ${params.pouchColor.trim()}`
      : null,
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

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="7" r="1" fill="currentColor" />
    </svg>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M14 5v8.2a4.2 4.2 0 1 1-3-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 5c1 .9 2.2 1.4 3.6 1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ThreadsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M6.321 6.016c-.27-.18-1.166-.802-1.166-.802.756-1.081 1.753-1.502 3.132-1.502.975 0 1.803.327 2.394.948s.928 1.509 1.005 2.644q.492.207.905.484c1.109.745 1.719 1.86 1.719 3.137 0 2.716-2.226 5.075-6.256 5.075C4.594 16 1 13.987 1 7.994 1 2.034 4.482 0 8.044 0 9.69 0 13.55.243 15 5.036l-1.36.353C12.516 1.974 10.163 1.43 8.006 1.43c-3.565 0-5.582 2.171-5.582 6.79 0 4.143 2.254 6.343 5.63 6.343 2.777 0 4.847-1.443 4.847-3.556 0-1.438-1.208-2.127-1.27-2.127-.236 1.234-.868 3.31-3.644 3.31-1.618 0-3.013-1.118-3.013-2.582 0-2.09 1.984-2.847 3.55-2.847.586 0 1.294.04 1.663.114 0-.637-.54-1.728-1.9-1.728-1.25 0-1.566.405-1.967.868ZM8.716 8.19c-2.04 0-2.304.87-2.304 1.416 0 .878 1.043 1.168 1.6 1.168 1.02 0 2.067-.282 2.232-2.423a6.2 6.2 0 0 0-1.528-.161" />
    </svg>
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

  const { basePrice, finalPrice, hasDiscount, discountPercent, currency } =
    calcLocalizedDiscountedPrice({
      locale,
      priceUAH: v?.priceUAH ?? p.basePriceUAH ?? 0,
      priceUSD: (v as any)?.priceUSD ?? (p as any).basePriceUSD ?? null,
      discountPercent: v?.discountPercent,
      discountUAH: v?.discountUAH ?? 0,
    })
  const { basePrice: basePriceUAH, finalPrice: finalPriceUAH } =
    calcLocalizedDiscountedPrice({
      locale: 'uk',
      priceUAH: v?.priceUAH ?? p.basePriceUAH ?? 0,
      discountPercent: v?.discountPercent,
      discountUAH: v?.discountUAH ?? 0,
    })

  const extraTotalUAH =
    selectedSizeExtraPriceUAH +
    selectedPouchExtraPriceUAH +
    selectedStrapExtraPriceUAH

  const basePriceWithOptions = basePrice + extraTotalUAH
  const finalPriceWithOptions = finalPrice + extraTotalUAH
  const finalPriceWithOptionsUAH = finalPriceUAH + extraTotalUAH
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
    t('Відправка протягом 1–3 днів', 'Ships within 1-3 days')
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
  const optionPriceUnitLabel = currency === 'USD' ? 'USD' : t('грн', 'UAH')

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
      color: selectedVariantColor || null,
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

      const addonName = pickLocalizedText(
        addonV.product.name,
        (addonV.product as any).nameEn,
        locale,
      )
      const addonColor = pickLocalizedText(
        addonV.color,
        (addonV as any).colorEn,
        locale,
      )
      const name = `${addonName}${addonColor ? ` — ${addonColor}` : ''}`

      add({
        productId: addonV.product.id,
        variantId: addonV.id,
        name,
        color: addonColor || null,
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
                      'Відкрито передзамовлення (7–14 робочих днів). Залиште контакт — ми напишемо вам.',
                      'Pre-order is open (7-14 business days). Leave contact details and we will reach out.',
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
                        {t('Конструктор', 'Configurator')}
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
                        <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                          {t('Крок', 'Step')} {stepNumberById.get('color')}:{' '}
                          {t('Загальний колір', 'Base color')}
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
                                  const nextId =
                                    pickPreferredVariantForColorKey(
                                      option.key,
                                    )?.id
                                  selectedVariantIdRef.current = nextId
                                  setSelectedVariantId(nextId)
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
                            {t(
                              'Початковий колір із каталогу',
                              'Initial color from catalog',
                            )}
                            : {selectedColorLabel || '—'}
                          </div>
                        )}
                      </div>

                      {showSizeStepBlock && (
                        <div>
                          <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
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
                                  onClick={() => setSelectedSizeId(size.id)}
                                  className={`rounded-full border px-3 py-1.5 text-xs transition cursor-pointer ${
                                    isActive
                                      ? 'border-black bg-black text-white'
                                      : 'border-gray-300 bg-white text-gray-900 hover:border-black'
                                  }`}
                                >
                                  {size.size}
                                  {extra > 0
                                    ? ` (+${extra} ${optionPriceUnitLabel})`
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

                      {showPouchStepBlock && (
                        <div>
                          <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                            {t('Крок', 'Step')} {stepNumberById.get('pouch')}:{' '}
                            {t('Колір мішечка', 'Pouch color')}
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
                                  {extra > 0
                                    ? ` (+${extra} ${optionPriceUnitLabel})`
                                    : ''}
                                </button>
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
                          <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                            {t('Крок', 'Step')} {stepNumberById.get('strap')}:{' '}
                            {t('Ремінець', 'Strap')}
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
                                    {extra > 0
                                      ? ` (+${extra} ${optionPriceUnitLabel})`
                                      : ''}
                                  </span>
                                </button>
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
                    </div>
                  </div>

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
                      <span>{t('Колір', 'Color')}:</span>
                      {selectedVariantColor && (
                        <span className="font-medium text-gray-900">
                          {selectedVariantColor}
                        </span>
                      )}
                    </div>
                    <VariantSwatches
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
