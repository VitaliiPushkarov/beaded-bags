'use client'

import { ProductType } from '@prisma/client'
import { TYPE_LABELS, COLOR_LABELS } from '@/lib/labels'
import { useEffect, useId } from 'react'
import clsx from 'clsx'

export type FiltersValue = {
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

const TYPE_OPTIONS: ProductType[] = [
  'BAG',
  'BELT_BAG',
  'BACKPACK',
  'SHOPPER',
  'CASE',
  'ORNAMENTS',
  'ACCESSORY',
]

type Props = {
  value: FiltersValue
  onChange: (next: FiltersValue) => void
  colors: string[]
  lockType?: boolean
  lockGroup?: boolean

  mobileOpen?: boolean
  onMobileClose?: () => void

  onApply?: () => void
}

export default function ProductsFilter({
  value,
  onChange,
  colors,
  lockType = false,
  lockGroup = false,
  mobileOpen = false,
  onMobileClose,
  onApply,
}: Props) {
  const ui = value

  const sortNameDesktop = useId()
  const sortNameMobile = useId()

  // Блокуємо прокрутку body, коли мобільна шторка відкрита
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [mobileOpen])

  const Controls = (sortName: string) => (
    <>
      {/* верхній рядок: чекбокси + сортування */}
      <div className="flex justify-between flex-nowrap mb-[26px] uppercase">
        <div>
          <div className="flex flex-wrap gap-x-3 gap-y-3 mb-[34px]">
            {/* В наявності */}
            <label className="flex items-center md:gap-2 gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={ui.inStock}
                onChange={(e) => onChange({ ...ui, inStock: e.target.checked })}
                className="w-4 h-4 cursor-pointer"
              />
              В наявності
            </label>

            {/* On sale */}
            <label className="flex items-center md:gap-2 gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={ui.onSale}
                onChange={(e) => onChange({ ...ui, onSale: e.target.checked })}
                className="w-4 h-4 cursor-pointer"
              />
              On sale
            </label>

            {/* сортування: базове (новинки/популярні) */}
            <label className="inline-flex items-center md:gap-2 gap-1 cursor-pointer">
              <input
                type="radio"
                name={sortName}
                checked={ui.sortBase === 'new'}
                onClick={() =>
                  onChange({
                    ...ui,
                    sortBase: ui.sortBase === 'new' ? '' : 'new',
                  })
                }
                onChange={() => {}}
              />
              <span>Новинки</span>
            </label>
            <label className="inline-flex items-center md:gap-2 gap-1 cursor-pointer">
              <input
                type="radio"
                name={sortName}
                checked={ui.sortBase === 'popular'}
                onClick={() =>
                  onChange({
                    ...ui,
                    sortBase: ui.sortBase === 'popular' ? '' : 'popular',
                  })
                }
                onChange={() => {}}
              />
              <span>Популярні</span>
            </label>

            {/* сортування: за ціною (незалежне) */}
            <div className="flex flex-wrap gap-x-3 gap-y-3">
              <label className="inline-flex items-center md:gap-2 gap-1 cursor-pointer">
                <input
                  type="radio"
                  name={`${sortName}-price`}
                  checked={ui.sortPrice === 'desc'}
                  onClick={() =>
                    onChange({
                      ...ui,
                      sortPrice: ui.sortPrice === 'desc' ? '' : 'desc',
                    })
                  }
                  onChange={() => {}}
                />
                <span>↓₴</span>
              </label>
              <label className="inline-flex items-center md:gap-2 gap-1 cursor-pointer">
                <input
                  type="radio"
                  name={`${sortName}-price`}
                  checked={ui.sortPrice === 'asc'}
                  onClick={() =>
                    onChange({
                      ...ui,
                      sortPrice: ui.sortPrice === 'asc' ? '' : 'asc',
                    })
                  }
                  onChange={() => {}}
                />
                <span>↑₴</span>
              </label>
            </div>
          </div>

          {/* другий рядок: група / тип / колір */}
          <div className="flex flex-col lg:flex-row lg:flex-wrap gap-y-4 gap-x-10 items-start lg:items-center">
            {/* Група - якщо не зафіксований */}
            {!lockGroup && (
              <div className="flex items-center gap-3">
                <span className="uppercase tracking-wide">Група:</span>
                <select
                  className="border px-3 py-1 rounded bg-white w-40 cursor-pointer"
                  value={ui.group}
                  onChange={(e) =>
                    onChange({
                      ...ui,
                      group: e.target.value as FiltersValue['group'],
                    })
                  }
                >
                  <option value="">Всі</option>
                  <option value="BEADS">Бісер</option>
                  <option value="WEAVING">Плетіння</option>
                </select>
              </div>
            )}

            {/* Тип — якщо не зафіксований */}
            {!lockType && (
              <div className="flex items-center gap-3">
                <span className="uppercase tracking-wide">Тип:</span>
                <select
                  className="border px-3 py-1 rounded bg-white w-40 cursor-pointer"
                  value={ui.bagTypes || ''}
                  onChange={(e) =>
                    onChange({
                      ...ui,
                      bagTypes: e.target.value as FiltersValue['bagTypes'],
                    })
                  }
                >
                  <option value="">Всі</option>
                  {TYPE_OPTIONS.map((bt) => (
                    <option key={bt} value={bt}>
                      {TYPE_LABELS[bt] ?? bt}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Колір */}
            <div className="flex items-center gap-3">
              <span className="uppercase tracking-wide">Колір:</span>
              <select
                className="border px-3 py-1 rounded bg-white w-40 cursor-pointer"
                value={ui.color}
                onChange={(e) => onChange({ ...ui, color: e.target.value })}
              >
                <option value="">Всі</option>
                {colors.map((c) => (
                  <option key={c} value={c}>
                    {COLOR_LABELS[c] || c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* третій рядок: ціна */}
          <div className="mt-[34px] flex items-center gap-3">
            <span>Ціна:</span>
            <input
              placeholder="60 грн"
              inputMode="numeric"
              value={ui.min}
              onChange={(e) =>
                onChange({
                  ...ui,
                  min: e.target.value.replace(/[^\d]/g, ''),
                })
              }
              className="w-20 border-b border-black bg-transparent outline-none text-gray-700 placeholder-gray-400"
            />
            <span>до</span>
            <input
              placeholder="3500 грн"
              inputMode="numeric"
              value={ui.max}
              onChange={(e) =>
                onChange({
                  ...ui,
                  max: e.target.value.replace(/[^\d]/g, ''),
                })
              }
              className="w-24 border-b border-black bg-transparent outline-none text-gray-700 placeholder-gray-400"
            />
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop (inline) */}
      <div className="hidden lg:block">{Controls(sortNameDesktop)}</div>

      {/* Mobile full-screen overlay */}
      <div
        className={clsx(
          'lg:hidden fixed inset-0 z-50',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'
        )}
        aria-hidden={!mobileOpen}
      >
        {/* Backdrop */}
        <div
          className={clsx(
            'absolute inset-0 bg-black/40 transition-opacity',
            mobileOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={onMobileClose}
        />

        {/* Panel */}
        <div
          className={clsx(
            'absolute inset-x-0 bottom-0 top-0 bg-white flex flex-col transition-transform',
            mobileOpen ? 'translate-y-0' : 'translate-y-full'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-lg font-medium">Фільтри</h3>
            <button
              type="button"
              onClick={onMobileClose}
              className="px-3 py-1 rounded border hover:bg-gray-50"
            >
              Закрити
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-auto px-4 py-4">
            {Controls(sortNameMobile)}
          </div>

          {/* Sticky footer actions */}
          <div className="border-t p-4">
            <button
              type="button"
              onClick={onApply}
              className="w-full h-11 rounded bg-black text-white hover:bg-[#FF3D8C] transition disabled:opacity-50 cursor-pointer"
            >
              Застосувати
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
