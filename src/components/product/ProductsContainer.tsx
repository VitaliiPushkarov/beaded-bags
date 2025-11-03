'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import ProductsFilter from './ProductsFilter'
import AppliedChips from './AppliedChips'
import ProductsGrid from './ProductsGrid'
import Breadcrumbs from '../ui/BreadCrumbs'
import type { Product, ProductVariant, ProductType } from '@prisma/client'
import { TYPE_LABELS, COLOR_LABELS } from '@/lib/labels'

export type UIFilters = {
  q: string
  inStock: boolean
  onSale: boolean
  group: '' | 'Бісер' | 'Плетіння'
  bagTypes: '' | ProductType
  color: string
  min: string
  max: string
  sort: 'new' | 'popular' | 'Ціна за спаданням' | 'Ціна за зростанням'
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
  sort: 'new',
}

type ProductWithVariants = Product & { variants: ProductVariant[] }

function getMinPrice(p: ProductWithVariants) {
  const list: number[] = []
  if (typeof p.basePriceUAH === 'number') list.push(p.basePriceUAH)
  p.variants?.forEach((v) => {
    if (typeof v.priceUAH === 'number') list.push(v.priceUAH)
  })
  return list.length ? Math.min(...list) : 0
}

function isInStock(p: ProductWithVariants) {
  if (p.inStock) return true
  return Boolean(p.variants?.some((v) => v.inStock))
}

function isBeadType(p: ProductWithVariants) {
  const n = (p.name || '').toLowerCase()
  return /bead|beaded|бісер/.test(n)
}

function matchesColor(p: ProductWithVariants, color: string) {
  if (!color) return true

  return !!p.variants?.some((v) => v.color === color)
}

function hasOnSale(p: unknown): p is { onSale: boolean } {
  return (
    typeof p === 'object' &&
    p !== null &&
    'onSale' in (p as Record<string, unknown>) &&
    typeof (p as { onSale: unknown }).onSale === 'boolean'
  )
}

function resetKey(source: UIFilters, key: keyof UIFilters): UIFilters {
  const next: UIFilters = { ...source }
  // індексно, але без any
  ;(next as Record<keyof UIFilters, unknown>)[key] = DEFAULT_FILTERS[key]
  return next
}

export default function ProductsContainer({
  initialProducts,
  initialFilters,
  lockedType,
  title = 'Каталог',
}: {
  initialProducts: ProductWithVariants[]
  initialFilters?: Partial<UIFilters>
  lockedType?: ProductType
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
    bagTypes: lockedType ?? (initialFilters?.bagTypes as ProductType) ?? '',
  }))

  // 2) застосовані (те, що реально вплинуло на список)
  const [applied, setApplied] = useState<UIFilters>(() => ({
    ...DEFAULT_FILTERS,
    ...initialFilters,
    bagTypes: lockedType ?? (initialFilters?.bagTypes as ProductType) ?? '',
  }))

  const [hasApplied, setHasApplied] = useState(
    Boolean(initialFilters && Object.keys(initialFilters).length > 0)
  )
  const [isDirty, setIsDirty] = useState(false)

  // якщо НЕ зафіксований тип — підхоплюємо ?type= з URL
  useEffect(() => {
    if (lockedType) return
    const t = sp.get('type')
    if (t) {
      setUI((s) => ({ ...s, bagTypes: t as ProductType }))
      setIsDirty(true)
    }
  }, [sp, lockedType])

  // live-синк у URL (але це ще не "застосовано")
  useEffect(() => {
    const params = new URLSearchParams()
    if (ui.q) params.set('q', ui.q)
    if (!lockedType && ui.bagTypes) params.set('type', ui.bagTypes)
    if (ui.color) params.set('color', ui.color)
    if (ui.sort !== 'new') params.set('sort', ui.sort)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [ui, router, pathname, lockedType])

  // застосувати
  const apply = () => {
    setLoading(true)

    // якщо тип зафіксований — ми його примусово кладемо в застосовані
    const toApply: UIFilters = lockedType ? { ...ui, bagTypes: lockedType } : ui

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
    if (toApply.inStock) arr = arr.filter(isInStock)

    // акції (тільки якщо є поле onSale)
    if (toApply.onSale) {
      arr = arr.filter((p) => hasOnSale(p) && p.onSale === true)
    }

    // група
    if (toApply.group) {
      arr = arr.filter((p) =>
        toApply.group === 'Бісер' ? isBeadType(p) : !isBeadType(p)
      )
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

    // сортування
    switch (toApply.sort) {
      case 'Ціна за спаданням':
        arr.sort((a, b) => getMinPrice(a) - getMinPrice(b))
        break
      case 'Ціна за зростанням':
        arr.sort((a, b) => getMinPrice(b) - getMinPrice(a))
        break
      case 'popular':
        arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        break
      case 'new':
      default:
        break
    }

    setApplied(toApply)
    setHasApplied(true)
    setVisible(arr)
    setIsDirty(false)
    setLoading(false)

    // оновлюємо урл вже з застосованими значеннями
    const params = new URLSearchParams()
    if (toApply.q) params.set('q', toApply.q)
    if (!lockedType && toApply.bagTypes) params.set('type', toApply.bagTypes)
    if (toApply.color) params.set('color', toApply.color)
    if (toApply.sort !== 'new') params.set('sort', toApply.sort)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)

    // закриємо мобільний фільтр після застосування
    setMobileOpen(false)
  }

  const clearAll = () => {
    const next: UIFilters = {
      ...DEFAULT_FILTERS,
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
    const out: { key: keyof UIFilters | 'price' | 'sort'; label: string }[] = []
    if (applied.q.trim()) out.push({ key: 'q', label: `“${applied.q.trim()}”` })
    if (applied.inStock) out.push({ key: 'inStock', label: 'В наявності' })
    if (applied.onSale) out.push({ key: 'onSale', label: 'On sale' })
    if (applied.group)
      out.push({ key: 'group', label: `Група: ${applied.group}` })
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
    if (applied.sort !== 'new')
      out.push({ key: 'sort', label: `Сортування: ${applied.sort}` })
    return out
  }, [applied, lockedType])

  const removeChip = (key: string) => {
    let next: UIFilters

    if (key === 'price') {
      next = { ...applied, min: '', max: '' }
    } else if (key === 'sort') {
      next = { ...applied, sort: DEFAULT_FILTERS.sort }
    } else {
      const k = key as keyof UIFilters
      next = resetKey(applied, k)
    }

    // якщо тип зафіксований сторінкою — не даємо його прибрати
    if (lockedType && key === 'bagTypes') {
      next.bagTypes = lockedType
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

    if (next.inStock) arr = arr.filter(isInStock)
    if (next.onSale) arr = arr.filter((p) => hasOnSale(p) && p.onSale === true)
    if (next.group) {
      arr = arr.filter((p) =>
        next.group === 'Бісер' ? isBeadType(p) : !isBeadType(p)
      )
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
  }

  return (
    <div className="max-w-[1440px] mx-auto py-10 px-[50px]">
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
            className="px-6 py-2 rounded bg-black text-white hover:bg-[#FF3D8C] transition h-[44px] w-[275px] disabled:opacity-50 disabled:cursor-not-allowed"
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
