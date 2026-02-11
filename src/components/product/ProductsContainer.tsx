'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import ProductsFilter from './ProductsFilter'
import AppliedChips from './AppliedChips'
import ProductsGrid from './ProductsGrid'
import Breadcrumbs from '../ui/BreadCrumbs'
import type { ProductType } from '@prisma/client'
import { TYPE_LABELS, COLOR_LABELS } from '@/lib/labels'
import type { ProductWithVariants as CardProductWithVariants } from '@/app/products/ProductCardLarge'
import { resolveDiscountPercent } from '@/lib/pricing'

export type UIFilters = {
  q: string
  inStock: boolean
  onSale: boolean
  group: '' | 'BEADS' | 'WEAVING'
  bagTypes: '' | ProductType
  color: string
  min: string
  max: string
  sortBase: '' | 'new' | 'popular'
  sortPrice: '' | 'asc' | 'desc'
}

const DEFAULT_FILTERS: UIFilters = {
  q: '',
  inStock: false,
  onSale: false,
  group: '',
  bagTypes: '',
  color: '',
  min: '',
  max: '',
  sortBase: '',
  sortPrice: '',
}

type ProductWithVariants = CardProductWithVariants

function getMinPrice(p: ProductWithVariants) {
  const list: number[] = []
  if (typeof p.basePriceUAH === 'number') list.push(p.basePriceUAH)
  p.variants?.forEach((v) => {
    if (typeof v.priceUAH === 'number') list.push(v.priceUAH)
  })
  return list.length ? Math.min(...list) : 0
}

function isInStock(p: ProductWithVariants) {
  // Variant-first stock model:
  // - If variants exist, stock is true only when at least one variant is in stock.
  // - Only fall back to product-level inStock for products without variants.
  if (p.variants && p.variants.length > 0) {
    return p.variants.some((v) => v.inStock === true)
  }
  return p.inStock === true
}

function withOnlyInStockVariants(
  p: ProductWithVariants,
): ProductWithVariants | null {
  // If there are no variants, keep the product intact (product-level stock applies).
  if (!p.variants || p.variants.length === 0) return p

  const nextVariants = p.variants.filter((v) => v.inStock === true)

  // If no variants are in stock — drop the product from the in-stock view
  if (nextVariants.length === 0) return null

  // Return a shallow copy so we never mutate `base`
  return { ...(p as any), variants: nextVariants } as ProductWithVariants
}

function matchesGroup(p: ProductWithVariants, group: UIFilters['group']) {
  if (!group) return true
  if (!p.group) return false
  return p.group === group
}

function normalizeGroupParam(v: string | null): UIFilters['group'] {
  if (!v) return ''
  if (v === 'BEADS' || v === 'WEAVING') return v
  if (v === 'Бісер') return 'BEADS'
  if (v === 'Плетіння') return 'WEAVING'
  return ''
}

function groupLabel(g: UIFilters['group']): string {
  if (g === 'BEADS') return 'Бісер'
  if (g === 'WEAVING') return 'Плетіння'
  return ''
}

function matchesColor(p: ProductWithVariants, color: string) {
  if (!color) return true

  return !!p.variants?.some((v) => v.color === color)
}

function isOnSale(p: ProductWithVariants) {
  // A product is "On sale" if any variant has a positive discount percent.
  return Boolean(
    p.variants?.some(
      (v) =>
        resolveDiscountPercent({
          basePriceUAH: v.priceUAH ?? p.basePriceUAH ?? 0,
          discountPercent: v.discountPercent,
          discountUAH: v.discountUAH ?? 0,
        }) > 0,
    ),
  )
}

function resetKey(source: UIFilters, key: keyof UIFilters): UIFilters {
  const next: UIFilters = { ...source }

  ;(next as Record<keyof UIFilters, unknown>)[key] = DEFAULT_FILTERS[key]
  return next
}

export default function ProductsContainer({
  initialProducts,
  initialFilters,
  lockedType,
  lockedGroup,
  title = 'Каталог',
}: {
  initialProducts: ProductWithVariants[]
  initialFilters?: Partial<UIFilters>
  lockedType?: ProductType
  lockedGroup?: UIFilters['group']
  title?: string
}) {
  // початковий масив
  const [base] = useState<ProductWithVariants[]>(initialProducts)
  const [visible, setVisible] = useState<ProductWithVariants[]>(initialProducts)
  const [loading, setLoading] = useState(false)

  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // окремий стан для мобільного фільтру замість __mobile у ui
  const [mobileOpen, setMobileOpen] = useState(false)

  // 1) UI-стан (те, що юзер крутить у формі)
  const [ui, setUI] = useState<UIFilters>(() => ({
    ...DEFAULT_FILTERS,
    ...initialFilters,
    group: lockedGroup ?? (initialFilters?.group as UIFilters['group']) ?? '',
    bagTypes: lockedType ?? (initialFilters?.bagTypes as ProductType) ?? '',
  }))

  // 2) застосовані (те, що реально вплинуло на список)
  const [applied, setApplied] = useState<UIFilters>(() => ({
    ...DEFAULT_FILTERS,
    ...initialFilters,
    group: lockedGroup ?? (initialFilters?.group as UIFilters['group']) ?? '',
    bagTypes: lockedType ?? (initialFilters?.bagTypes as ProductType) ?? '',
  }))

  const [hasApplied, setHasApplied] = useState(
    Boolean(initialFilters && Object.keys(initialFilters).length > 0),
  )
  const [isDirty, setIsDirty] = useState(false)
  const [didInitFromUrl, setDidInitFromUrl] = useState(false)

  // ініціалізація фільтрів з URL (без зациклення)
  useEffect(() => {
    if (lockedType) {
      setDidInitFromUrl(true)
      return
    }

    const t = sp.get('type') as ProductType | null
    const g = lockedGroup ? '' : normalizeGroupParam(sp.get('group'))

    setUI((prev) => {
      // не перетираємо вибір юзера
      const next: UIFilters = { ...prev }
      if (!next.bagTypes && t) next.bagTypes = t
      if (!lockedGroup && !next.group && g) next.group = g
      return next
    })

    setDidInitFromUrl(true)
  }, [sp, lockedType, lockedGroup])

  // застосувати
  const apply = () => {
    setLoading(true)

    // якщо тип зафіксований — ми його примусово кладемо в застосовані
    const toApply: UIFilters = lockedType
      ? { ...ui, bagTypes: lockedType, group: lockedGroup ?? ui.group }
      : { ...ui, group: lockedGroup ?? ui.group }

    let arr = [...base]

    // пошук
    if (toApply.q.trim()) {
      const q = toApply.q.trim().toLowerCase()
      arr = arr.filter((p) => {
        const pool = [p.name?.toLowerCase() || '']
        p.variants?.forEach((v) => v.color && pool.push(v.color.toLowerCase()))
        return pool.some((x) => x.includes(q))
      })
    }

    // наявність
    if (toApply.inStock) {
      arr = arr
        .filter(isInStock)
        .map(withOnlyInStockVariants)
        .filter((p): p is ProductWithVariants => Boolean(p))
    }

    // акції (variant-level discount)
    if (toApply.onSale) {
      arr = arr.filter(isOnSale)
    }

    // група
    if (toApply.group) {
      arr = arr.filter((p) => matchesGroup(p, toApply.group))
    }

    // тип
    if (toApply.bagTypes) {
      arr = arr.filter((p) => p.type === toApply.bagTypes)
    }

    // колір
    if (toApply.color) {
      arr = arr.filter((p) => matchesColor(p, toApply.color))
    }

    // ціна
    const minNum = toApply.min ? Number(toApply.min) || 0 : -Infinity
    const maxNum = toApply.max ? Number(toApply.max) || Infinity : Infinity
    arr = arr.filter((p) => {
      const prices: number[] = []
      if (typeof p.basePriceUAH === 'number') prices.push(p.basePriceUAH)
      p.variants?.forEach((v) => {
        if (typeof v.priceUAH === 'number') prices.push(v.priceUAH)
      })
      if (!prices.length) prices.push(0)
      return prices.some((price) => price >= minNum && price <= maxNum)
    })

    // сортування (незалежні контролі)
    // пріоритет: ціна (якщо вибрана) → інакше popular → інакше (new або без) лишаємо порядок як є
    if (toApply.sortPrice === 'asc') {
      arr.sort((a, b) => {
        const d = getMinPrice(a) - getMinPrice(b)
        return d !== 0 ? d : (a.name || '').localeCompare(b.name || '')
      })
    } else if (toApply.sortPrice === 'desc') {
      arr.sort((a, b) => {
        const d = getMinPrice(b) - getMinPrice(a)
        return d !== 0 ? d : (a.name || '').localeCompare(b.name || '')
      })
    } else if (toApply.sortBase === 'popular') {
      arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }

    setApplied(toApply)
    setHasApplied(true)
    setVisible(arr)
    setIsDirty(false)
    setLoading(false)

    // оновлюємо урл вже з застосованими значеннями
    const params = new URLSearchParams()
    if (toApply.q) params.set('q', toApply.q)
    if (toApply.inStock) params.set('inStock', '1')
    if (toApply.onSale) params.set('onSale', '1')
    if (!lockedType && toApply.bagTypes) params.set('type', toApply.bagTypes)
    if (!lockedGroup && toApply.group) params.set('group', toApply.group)
    if (toApply.color) params.set('color', toApply.color)
    if (toApply.min) params.set('min', toApply.min)
    if (toApply.max) params.set('max', toApply.max)
    if (toApply.sortBase) params.set('sortBase', toApply.sortBase)
    if (toApply.sortPrice) params.set('sortPrice', toApply.sortPrice)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)

    // закриємо мобільний фільтр після застосування
    setMobileOpen(false)
  }

  const clearAll = () => {
    const next: UIFilters = {
      ...DEFAULT_FILTERS,
      ...(lockedGroup ? { group: lockedGroup } : {}),
      ...(lockedType ? { bagTypes: lockedType } : {}),
    }

    setUI(next)
    setApplied(next)
    setHasApplied(false)
    setIsDirty(false)
    setVisible(base)
    router.replace(pathname)
  }

  // кольори з продуктів
  const colors = useMemo(() => {
    const set = new Set<string>()
    for (const p of base) {
      p.variants?.forEach((v) => {
        if (v.color) set.add(v.color)
      })
    }
    return Array.from(set)
  }, [base])

  // chips (тільки з застосованих)
  const chips = useMemo(() => {
    const out: {
      key: keyof UIFilters | 'price' | 'sortBase' | 'sortPrice'
      label: string
    }[] = []
    if (applied.q.trim()) out.push({ key: 'q', label: `“${applied.q.trim()}”` })
    if (applied.inStock) out.push({ key: 'inStock', label: 'В наявності' })
    if (applied.onSale) out.push({ key: 'onSale', label: 'On sale' })
    if (!lockedGroup && applied.group)
      out.push({ key: 'group', label: `Група: ${groupLabel(applied.group)}` })
    if (!lockedType && applied.bagTypes)
      out.push({
        key: 'bagTypes',
        label: `Тип: ${TYPE_LABELS[applied.bagTypes] || applied.bagTypes}`,
      })
    if (applied.color)
      out.push({
        key: 'color',
        label: `Колір: ${COLOR_LABELS[applied.color] || applied.color}`,
      })
    if (applied.min || applied.max)
      out.push({
        key: 'price',
        label: `Ціна: ${applied.min || '—'} — ${applied.max || '—'}`,
      })
    if (applied.sortBase) {
      out.push({
        key: 'sortBase',
        label: `Сортування: ${
          applied.sortBase === 'new' ? 'Новинки' : 'Популярні'
        }`,
      })
    }
    if (applied.sortPrice) {
      out.push({
        key: 'sortPrice',
        label: `Сортування: ${
          applied.sortPrice === 'asc' ? 'Ціна ↑' : 'Ціна ↓'
        }`,
      })
    }
    return out
  }, [applied, lockedType, lockedGroup])

  const removeChip = (key: string) => {
    let next: UIFilters

    if (key === 'price') {
      next = { ...applied, min: '', max: '' }
    } else if (key === 'sortBase') {
      next = { ...applied, sortBase: '' }
    } else if (key === 'sortPrice') {
      next = { ...applied, sortPrice: '' }
    } else if (key === 'sort') {
      // backward compatibility if something still sends 'sort'
      next = { ...applied, sortBase: '', sortPrice: '' }
    } else {
      const k = key as keyof UIFilters
      next = resetKey(applied, k)
    }

    // якщо тип зафіксований сторінкою — не даємо його прибрати
    if (lockedType && key === 'bagTypes') {
      next.bagTypes = lockedType
    }
    if (lockedGroup && key === 'group') {
      next.group = lockedGroup
    }
    setApplied(next)
    setUI((u) => ({ ...u, ...next }))
    setIsDirty(false)

    // одразу перерахуємо список
    let arr = [...base]

    if (next.q.trim()) {
      const q = next.q.trim().toLowerCase()
      arr = arr.filter((p) => {
        const pool = [p.name?.toLowerCase() || '']
        p.variants?.forEach((v) => v.color && pool.push(v.color.toLowerCase()))
        return pool.some((x) => x.includes(q))
      })
    }

    if (next.inStock)
      arr = arr
        .filter(isInStock)
        .map(withOnlyInStockVariants)
        .filter((p): p is ProductWithVariants => Boolean(p))
    if (next.onSale) arr = arr.filter(isOnSale)
    if (next.group) {
      arr = arr.filter((p) => matchesGroup(p, next.group))
    }
    if (next.bagTypes) {
      arr = arr.filter((p) => p.type === next.bagTypes)
    }
    if (next.color) {
      arr = arr.filter((p) => matchesColor(p, next.color))
    }

    const minNum = next.min ? Number(next.min) || 0 : -Infinity
    const maxNum = next.max ? Number(next.max) || Infinity : Infinity
    arr = arr.filter((p) => {
      const prices: number[] = []
      if (typeof p.basePriceUAH === 'number') prices.push(p.basePriceUAH)
      p.variants?.forEach((v) => {
        if (typeof v.priceUAH === 'number') prices.push(v.priceUAH)
      })
      if (!prices.length) prices.push(0)
      return prices.some((price) => price >= minNum && price <= maxNum)
    })

    setVisible(arr)

    // update URL to reflect the new state (including min/max)
    const params = new URLSearchParams()
    if (next.q) params.set('q', next.q)
    if (next.inStock) params.set('inStock', '1')
    if (next.onSale) params.set('onSale', '1')
    if (!lockedType && next.bagTypes) params.set('type', next.bagTypes)
    if (!lockedGroup && next.group) params.set('group', next.group)
    if (next.color) params.set('color', next.color)
    if (next.min) params.set('min', next.min)
    if (next.max) params.set('max', next.max)
    if (next.sortBase) params.set('sortBase', next.sortBase)
    if (next.sortPrice) params.set('sortPrice', next.sortPrice)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="max-w-[1440px] mx-auto py-6 px-5 md:px-[50px]">
      <Breadcrumbs />
      {/* mobile header */}
      <div className="lg:hidden flex items-center justify-between py-4">
        <h1 className="text-2xl">{title}</h1>
        <button
          onClick={() => setMobileOpen(true)}
          className="uppercase flex items-center gap-2"
        >
          Фільтр +
        </button>
      </div>

      {/* Desktop */}
      <div className="hidden lg:block">
        <div className="flex justify-between mb-6 items-end">
          <h1 className="text-3xl">{title}</h1>
          <button
            onClick={apply}
            disabled={!isDirty}
            className="px-6 py-2 rounded bg-black text-white hover:bg-[#FF3D8C] transition h-11 w-[275px] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Застосувати
          </button>
        </div>
      </div>

      <ProductsFilter
        value={ui}
        onChange={(next) => {
          setUI(next)
          setIsDirty(true)
        }}
        colors={colors}
        lockType={Boolean(lockedType)}
        lockGroup={Boolean(lockedGroup)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onApply={apply}
      />
      {hasApplied && chips.length > 0 && (
        <AppliedChips chips={chips} onRemove={removeChip} onClear={clearAll} />
      )}
      <ProductsGrid products={visible} loading={loading} />
    </div>
  )
}
