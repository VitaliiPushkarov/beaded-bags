'use client'

import { useMemo, useState } from 'react'
import { PRODUCTS } from '@/lib/products'
import ProductCardLarge from './ProductCardLarge'
import { set } from 'zod'

type Product = (typeof PRODUCTS)[number]
type Variant = NonNullable<Product['variants']>[number]

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
  return Boolean(p.inStock || p.variants?.some((v) => v.inStock))
}

function isBeadType(p: Product) {
  const n = (p.name || '').toLowerCase()
  return /bead|beaded|бісер/.test(n)
}
function matchesColor(p: Product, color: string) {
  if (!color) return true
  if ((p as any).color && (p as any).color === color) return true
  return !!p.variants?.some((v) => v.color === color)
}
function matchesSearch(p: Product, q: string) {
  if (!q) return true
  const s = q.trim().toLowerCase()
  if (!s) return true
  const fields: string[] = []
  fields.push(p.name?.toLowerCase() || '')
  p.variants?.forEach((v) => {
    if (v.color) fields.push(String(v.color).toLowerCase())
  })
  return fields.some((f) => f.includes(s))
}

export default function ProductsPage() {
  // Extract unique colors from products
  const colors = useMemo(() => {
    const set = new Set<string>()
    for (const p of PRODUCTS) {
      if ((p as any).color) set.add((p as any).color)
      p.variants?.forEach((v: Variant) => v.color && set.add(v.color))
    }
    return Array.from(set)
  }, [])
  type Sort = 'new' | 'popular' | 'cheap' | 'exp'
  type TypeFilter = '' | 'Бісер' | 'Плетіння'

  type Filters = {
    q: string
    inStock: boolean
    onSale: boolean
    type: TypeFilter
    color: string
    min: string
    max: string
    sort: Sort
  }
  const initial: Filters = {
    q: '',
    inStock: false,
    onSale: false,
    type: '',
    color: '',
    min: '',
    max: '',
    sort: 'new',
  }

  const [ui, setUI] = useState<Filters>(initial)
  const [applied, setApplied] = useState<Filters>(initial)
  const [filterAppliedOnes, setFilterAppliedOnes] = useState(false)

  const apply = () => {
    setApplied(ui)
    setFilterAppliedOnes(true)
  }
  const clearAll = () => {
    const cleared: Filters = {
      q: '',
      inStock: false,
      onSale: false,
      type: '',
      color: '',
      min: '',
      max: '',
      sort: 'new',
    }
    setFilterAppliedOnes(false)
    setUI(cleared)
    setApplied(cleared)
  }

  // --- обчислення відфільтрованих/відсортованих товарів
  const filtered = useMemo(() => {
    let arr = [...PRODUCTS]
    // Search query
    if (applied.q.trim()) {
      arr = arr.filter((p) => matchesSearch(p, applied.q))
    }

    // в наявності
    if (applied.inStock) arr = arr.filter(isInStock)

    // on sale (якщо у товара є прапорець; інакше фільтр ігнорується)
    if (applied.onSale) {
      arr = arr.filter((p) => (p as any).onSale === true)
    }

    // тип
    if (applied.type) {
      arr = arr.filter((p) =>
        applied.type === 'Бісер' ? isBeadType(p) : !isBeadType(p)
      )
    }

    // колір
    if (applied.color) {
      arr = arr.filter((p) => matchesColor(p, applied.color))
    }

    // ціна
    const minNum = applied.min.trim() ? Number(applied.min) || 0 : -Infinity
    const maxNum = applied.max.trim()
      ? Number(applied.max) || Infinity
      : Infinity
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
    switch (applied.sort) {
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

    return arr
  }, [applied])
  // --- Чіпси для застосованих фільтрів
  const chips = useMemo(() => {
    const out: { key: string; label: string; onRemove: () => void }[] = []
    if (applied.q.trim()) {
      out.push({
        key: 'q',
        label: `“${applied.q.trim()}”`,
        onRemove: () => {
          const next = { ...applied, q: '' }
          setApplied(next)
          setUI((u) => ({ ...u, q: '' }))
        },
      })
    }
    if (applied.inStock) {
      out.push({
        key: 'inStock',
        label: 'В наявності',
        onRemove: () => {
          const next = { ...applied, inStock: false }
          setApplied(next)
          setUI((u) => ({ ...u, inStock: false }))
        },
      })
    }
    if (applied.onSale) {
      out.push({
        key: 'onSale',
        label: 'On sale',
        onRemove: () => {
          const next = { ...applied, onSale: false }
          setApplied(next)
          setUI((u) => ({ ...u, onSale: false }))
        },
      })
    }
    if (applied.type) {
      out.push({
        key: 'type',
        label: `Тип: ${applied.type}`,
        onRemove: () => {
          const next = { ...applied, type: '' as const }
          setApplied(next)
          setUI((u) => ({ ...u, type: '' as const }))
        },
      })
    }
    if (applied.color) {
      out.push({
        key: 'color',
        label: `Колір: ${applied.color}`,
        onRemove: () => {
          const next = { ...applied, color: '' }
          setApplied(next)
          setUI((u) => ({ ...u, color: '' }))
        },
      })
    }
    if (applied.min.trim() || applied.max.trim()) {
      const from = applied.min.trim() ? Number(applied.min) : undefined
      const to = applied.max.trim() ? Number(applied.max) : undefined
      out.push({
        key: 'price',
        label: `Ціна: ${from ?? '—'} — ${to ?? '—'} грн`,
        onRemove: () => {
          const next = { ...applied, min: '', max: '' }
          setApplied(next)
          setUI((u) => ({ ...u, min: '', max: '' }))
        },
      })
    }
    if (applied.sort !== 'new') {
      const sortLabel =
        applied.sort === 'popular'
          ? 'Популярні'
          : applied.sort === 'cheap'
          ? '↓$'
          : '↑$'
      out.push({
        key: 'sort',
        label: `Сортування: ${sortLabel}`,
        onRemove: () => {
          const next = { ...applied, sort: 'new' as const }
          setApplied(next)
          setUI((u) => ({ ...u, sort: 'new' as const }))
        },
      })
    }
    return out
  }, [applied])

  return (
    <div className="max-w-[1440px] mx-auto py-10 px-[50px]">
      <div className="fitler-block">
        <div className="flex justify-between flex-nowrap mb-[26px] uppercase">
          <div className="">
            <div className="flex mb-[34px]">
              {/* Checkboxes */}
              <label className="flex items-center gap-2 mr-[40px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={ui.inStock}
                  onChange={(e) =>
                    setUI((s) => ({ ...s, inStock: e.target.checked }))
                  }
                  className="w-4 h-4 cursor-pointer"
                />{' '}
                В наявності
              </label>
              <label className="flex items-center gap-2 mr-[40px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={ui.onSale}
                  onChange={(e) =>
                    setUI((s) => ({ ...s, onSale: e.target.checked }))
                  }
                  className="w-4 h-4 cursor-pointer"
                />{' '}
                On sale
              </label>

              <label className="inline-flex items-center gap-2 mr-[40px] cursor-pointer">
                <input
                  type="radio"
                  name="sort"
                  checked={ui.sort === 'new'}
                  onChange={() => setUI((s) => ({ ...s, sort: 'new' }))}
                />
                <span>Новинки</span>
              </label>
              <label className="inline-flex items-center gap-2 mr-[40px] cursor-pointer">
                <input
                  type="radio"
                  name="sort"
                  checked={ui.sort === 'popular'}
                  onChange={() => setUI((s) => ({ ...s, sort: 'popular' }))}
                />
                <span>Популярні</span>
              </label>
              <label className="inline-flex items-center gap-2 mr-[40px] cursor-pointer">
                <input
                  type="radio"
                  name="sort"
                  checked={ui.sort === 'cheap'}
                  onChange={() => setUI((s) => ({ ...s, sort: 'cheap' }))}
                />
                <span>↓$</span>
              </label>
              <label className="inline-flex items-center gap-2 mr-[40px] cursor-pointer">
                <input
                  type="radio"
                  name="sort"
                  checked={ui.sort === 'exp'}
                  onChange={() => setUI((s) => ({ ...s, sort: 'exp' }))}
                />
                <span>↑$</span>
              </label>
            </div>
            {/* Filter bar */}
            <div className="flex justify-start mb-[41px] items-center">
              {/* Dropdowns */}
              <div className="flex items-center gap-3 mr-[40px] cursor-pointer">
                <span className="uppercase tracking-wide">Тип:</span>
                <select
                  className="border px-3 py-1 rounded bg-white"
                  value={ui.type}
                  onChange={(e) =>
                    setUI((s) => ({
                      ...s,
                      type: e.target.value as TypeFilter,
                    }))
                  }
                >
                  <option value="">— Всі —</option>
                  <option value="Бісер">Бісер</option>
                  <option value="Плетіння">Плетіння</option>
                </select>
              </div>
              {/* Color */}
              <div className="flex items-center gap-3 mr-[40px] cursor-pointer">
                <span className="uppercase tracking-wide">Колір:</span>
                <select
                  className="border px-3 py-1 rounded bg-white"
                  value={ui.color}
                  onChange={(e) =>
                    setUI((s) => ({ ...s, color: e.target.value }))
                  }
                >
                  <option value="">— Всі —</option>
                  {colors.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price inputs */}
              <div className="flex items-center gap-3">
                <span>Ціна:</span>
                <input
                  placeholder="60 грн"
                  inputMode="numeric"
                  value={ui.min}
                  onChange={(e) =>
                    setUI((s) => ({
                      ...s,
                      min: e.target.value.replace(/[^\d]/g, ''),
                    }))
                  }
                  className="w-20 border-b border-black bg-transparent outline-none text-gray-700 placeholder-gray-400"
                />
                <span>до</span>
                <input
                  placeholder="3500 грн"
                  inputMode="numeric"
                  value={ui.max}
                  onChange={(e) =>
                    setUI((s) => ({
                      ...s,
                      max: e.target.value.replace(/[^\d]/g, ''),
                    }))
                  }
                  className="w-24 border-b border-black bg-transparent outline-none text-gray-700 placeholder-gray-400"
                />
              </div>
            </div>
          </div>

          {/* Actions */}

          <button
            onClick={apply}
            className="px-6 py-2 rounded bg-black text-white hover:bg-[#FF3D8C] transition h-[44px] w-[275px] self-end mb-[41px] cursor-pointer"
          >
            Застосувати
          </button>
        </div>
        {/* CHIPS */}
        <div className="mb-6">
          {filterAppliedOnes && chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-600">Ви шукали:</span>
              {chips.map((ch) => (
                <button
                  key={ch.key}
                  className="text-sm rounded-full border px-3 py-1 hover:bg-gray-50 flex items-center gap-2"
                  onClick={ch.onRemove}
                  title="Прибрати фільтр"
                >
                  {ch.label}
                  <span className="text-gray-400">×</span>
                </button>
              ))}
              <button
                className="ml-2 text-sm underline text-gray-600 hover:text-black"
                onClick={clearAll}
              >
                Видалити все
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.length === 0 && (
          <div className="col-span-full text-gray-500">
            За вашим запитом нічого не знайдено.
          </div>
        )}
        {filtered.map((p) => (
          <ProductCardLarge
            key={(p as any).id || (p as any).productId || p.slug}
            p={p as any}
          />
        ))}
      </div>
    </div>
  )
}
