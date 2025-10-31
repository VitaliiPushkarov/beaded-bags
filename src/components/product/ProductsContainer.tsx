'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import ProductsFilter from './ProductsFilter'
import AppliedChips from './AppliedChips'
import ProductsGrid from './ProductsGrid'
import Breadcrumbs from '../ui/BreadCrumbs'
import { ProductType } from '@prisma/client'
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
  sort: 'new' | 'popular' | 'cheap' | 'exp'
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

type Variant = {
  id: string
  color?: string | null
  hex?: string | null
  image?: string | null
  inStock?: boolean | null
  priceUAH?: number | null
}

type Product = {
  id: string
  slug: string
  name: string
  description?: string | null
  basePriceUAH?: number | null
  inStock?: boolean | null
  type?: ProductType | string | null
  color?: string | null
  variants?: Variant[]
}

function getMinPrice(p: Product) {
  const list: number[] = []
  if (typeof p.basePriceUAH === 'number') list.push(p.basePriceUAH)
  p.variants?.forEach((v) => {
    if (typeof v.priceUAH === 'number') list.push(v.priceUAH)
  })
  return list.length ? Math.min(...list) : 0
}

function isInStock(p: Product) {
  if (p.inStock) return true
  return Boolean(p.variants?.some((v) => v.inStock))
}

function isBeadType(p: Product) {
  const n = (p.name || '').toLowerCase()
  return /bead|beaded|бісер/.test(n)
}

function matchesColor(p: Product, color: string) {
  if (!color) return true
  if (p.color && p.color === color) return true
  return !!p.variants?.some((v) => v.color === color)
}

export default function ProductsContainer({
  initialProducts,
  initialFilters,
  lockType = false,
  title = 'Каталог',
}: {
  initialProducts: Product[]
  initialFilters?: Partial<UIFilters>
  lockType?: boolean
  title?: string
}) {
  const [base] = useState<Product[]>(initialProducts)
  const [visible, setVisible] = useState<Product[]>(initialProducts)
  const [loading, setLoading] = useState(false)

  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // 1) UI-стан
  const [ui, setUI] = useState<UIFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  })
  // 2) застосовані
  const [applied, setApplied] = useState<UIFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  })
  const [hasApplied, setHasApplied] = useState(
    initialFilters && Object.keys(initialFilters).length > 0
  )
  const [isDirty, setIsDirty] = useState(false)

  // 3) якщо ми НЕ lockType — підхоплюємо ?type= з URL
  useEffect(() => {
    if (lockType) return
    const t = sp.get('type')
    if (t) {
      // підхоплюємо з URL, але НЕ показуємо одразу чіпси
      setUI((s) => ({ ...s, bagTypes: t as ProductType }))
      setIsDirty(true)
      // applied не чіпаємо — хай юзер натисне "Застосувати"
    }
  }, [sp, lockType])

  useEffect(() => {
    // live-синхронізація q/color у URL, але без реального застосування
    const params = new URLSearchParams()
    if (ui.q) params.set('q', ui.q)
    if (!lockType && ui.bagTypes) params.set('type', ui.bagTypes)
    if (ui.color) params.set('color', ui.color)
    if (ui.sort !== 'new') params.set('sort', ui.sort)
    router.replace(`${pathname}?${params.toString()}`)
  }, [ui, router, pathname, lockType])

  // 4) застосувати
  const apply = () => {
    setLoading(true)
    let arr = [...base]

    if (ui.q.trim()) {
      const q = ui.q.trim().toLowerCase()
      arr = arr.filter((p) => {
        const pool = [p.name?.toLowerCase() || '']
        p.variants?.forEach((v) => v.color && pool.push(v.color.toLowerCase()))
        return pool.some((x) => x.includes(q))
      })
    }

    if (ui.inStock) arr = arr.filter(isInStock)

    if (ui.onSale) {
      arr = arr.filter((p) => (p as any).onSale === true)
    }

    if (ui.group) {
      arr = arr.filter((p) =>
        ui.group === 'Бісер' ? isBeadType(p) : !isBeadType(p)
      )
    }

    if (ui.bagTypes) {
      arr = arr.filter((p) => p.type === ui.bagTypes)
    }

    if (ui.color) {
      arr = arr.filter((p) => matchesColor(p, ui.color))
    }

    // price
    const minNum = ui.min ? Number(ui.min) || 0 : -Infinity
    const maxNum = ui.max ? Number(ui.max) || Infinity : Infinity
    arr = arr.filter((p) => {
      const prices: number[] = []
      if (typeof p.basePriceUAH === 'number') prices.push(p.basePriceUAH)
      p.variants?.forEach((v) => {
        if (typeof v.priceUAH === 'number') prices.push(v.priceUAH)
      })
      if (!prices.length) prices.push(0)
      return prices.some((price) => price >= minNum && price <= maxNum)
    })

    switch (ui.sort) {
      case 'cheap':
        arr.sort((a, b) => getMinPrice(a) - getMinPrice(b))
        break
      case 'exp':
        arr.sort((a, b) => getMinPrice(b) - getMinPrice(a))
        break
      case 'popular':
        arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        break
      case 'new':
      default:
        break
    }

    setApplied(ui)
    setHasApplied(true)
    setVisible(arr)
    setIsDirty(false)
    setLoading(false)

    // синхронізуємо в URL (опційно)
    const params = new URLSearchParams()
    if (ui.q) params.set('q', ui.q)
    if (!lockType && ui.bagTypes) params.set('type', ui.bagTypes)
    if (ui.color) params.set('color', ui.color)
    if (ui.sort !== 'new') params.set('sort', ui.sort)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const clearAll = () => {
    const next = {
      ...DEFAULT_FILTERS,
      ...(lockType ? { bagTypes: applied.bagTypes } : {}),
    }

    setUI(next)
    setApplied(next)
    setHasApplied(false)
    setIsDirty(false)

    setVisible(base)

    router.replace(pathname)
  }

  // 5) обчислення кольорів для селекту
  const colors = useMemo(() => {
    const set = new Set<string>()
    for (const p of base) {
      if (p.color) set.add(p.color)
      p.variants?.forEach((v) => v.color && set.add(v.color))
    }
    return Array.from(set)
  }, [base])

  // 7) chips
  const chips = useMemo(() => {
    const out: { key: keyof UIFilters | 'price' | 'sort'; label: string }[] = []
    if (applied.q.trim()) out.push({ key: 'q', label: `“${applied.q.trim()}”` })
    if (applied.inStock) out.push({ key: 'inStock', label: 'В наявності' })
    if (applied.onSale) out.push({ key: 'onSale', label: 'On sale' })
    if (applied.group)
      out.push({ key: 'group', label: `Група: ${applied.group}` })
    if (applied.bagTypes)
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
  }, [applied])

  const removeChip = (key: string) => {
    let next: UIFilters

    if (key === 'price') {
      next = { ...applied, min: '', max: '' }
    } else {
      next = {
        ...applied,
        [key]: DEFAULT_FILTERS[key as keyof UIFilters] as any,
      }
    }

    if (lockType && key === 'bagTypes') {
      next.bagTypes = applied.bagTypes
    }

    setApplied(next)
    setUI((u) => ({ ...u, ...next }))
    setIsDirty(false)

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
    if (next.onSale) arr = arr.filter((p) => (p as any).onSale === true)
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
      <div className="lg:hidden flex items-center justify-between py-4">
        <h1 className="text-2xl">{title}</h1>
        <button
          onClick={() => setUI((u) => ({ ...u, __mobile: true } as any))}
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
        <ProductsFilter
          value={ui}
          onChange={(next) => {
            setUI(next)
            setIsDirty(true)
          }}
          colors={colors}
          lockType={lockType}
        />
        {hasApplied && chips.length > 0 && (
          <AppliedChips
            chips={chips}
            onRemove={removeChip}
            onClear={clearAll}
          />
        )}
      </div>

      {/* Products */}
      <ProductsGrid products={visible} loading={loading} />
    </div>
  )
}
