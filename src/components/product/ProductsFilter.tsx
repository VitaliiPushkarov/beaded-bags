'use client'

import { ProductType } from '@prisma/client'
import { TYPE_LABELS, COLOR_LABELS } from '@/lib/labels'

export type FiltersValue = {
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

const TYPE_OPTIONS: ProductType[] = [
  'BAG',
  'BELT_BAG',
  'BACKPACK',
  'SHOPPER',
  'CASE',
]

export default function ProductsFilter({
  value,
  onChange,
  colors,
  lockType = false,
}: {
  value: FiltersValue
  onChange: (next: FiltersValue) => void
  colors: string[]
  lockType?: boolean
}) {
  const ui = value

  return (
    <div className="fitler-block">
      {/* верхній рядок: чекбокси + сортування */}
      <div className="flex justify-between flex-nowrap mb-[26px] uppercase">
        <div>
          <div className="flex mb-[34px]">
            {/* В наявності */}
            <label className="flex items-center gap-2 mr-[40px] cursor-pointer">
              <input
                type="checkbox"
                checked={ui.inStock}
                onChange={(e) => onChange({ ...ui, inStock: e.target.checked })}
                className="w-4 h-4 cursor-pointer"
              />{' '}
              В наявності
            </label>

            {/* On sale */}
            <label className="flex items-center gap-2 mr-[40px] cursor-pointer">
              <input
                type="checkbox"
                checked={ui.onSale}
                onChange={(e) => onChange({ ...ui, onSale: e.target.checked })}
                className="w-4 h-4 cursor-pointer"
              />{' '}
              On sale
            </label>

            {/* сортування */}
            <label className="inline-flex items-center gap-2 mr-[40px] cursor-pointer">
              <input
                type="radio"
                name="sort"
                checked={ui.sort === 'new'}
                onChange={() => onChange({ ...ui, sort: 'new' })}
              />
              <span>Новинки</span>
            </label>
            <label className="inline-flex items-center gap-2 mr-[40px] cursor-pointer">
              <input
                type="radio"
                name="sort"
                checked={ui.sort === 'popular'}
                onChange={() => onChange({ ...ui, sort: 'popular' })}
              />
              <span>Популярні</span>
            </label>
            <label className="inline-flex items-center gap-2 mr-[40px] cursor-pointer">
              <input
                type="radio"
                name="sort"
                checked={ui.sort === 'cheap'}
                onChange={() => onChange({ ...ui, sort: 'cheap' })}
              />
              <span>↓$</span>
            </label>
            <label className="inline-flex items-center gap-2 mr-[40px] cursor-pointer">
              <input
                type="radio"
                name="sort"
                checked={ui.sort === 'exp'}
                onChange={() => onChange({ ...ui, sort: 'exp' })}
              />
              <span>↑$</span>
            </label>
          </div>

          {/* другий рядок: група / тип / колір / ціна */}
          <div className="flex justify-start mb-[41px] items-center">
            {/* Група */}
            <div className="flex items-center gap-3 mr-[40px] cursor-pointer">
              <span className="uppercase tracking-wide">Група:</span>
              <select
                className="border px-3 py-1 rounded bg-white"
                value={ui.group}
                onChange={(e) =>
                  onChange({
                    ...ui,
                    group: e.target.value as FiltersValue['group'],
                  })
                }
              >
                <option value="">— Всі —</option>
                <option value="Бісер">Бісер</option>
                <option value="Плетіння">Плетіння</option>
              </select>
            </div>

            {/* Тип — показуємо тільки якщо не заблоковано */}
            {!lockType && (
              <div className="flex items-center gap-3 mr-[40px] cursor-pointer">
                <span className="uppercase tracking-wide">Тип:</span>
                <select
                  className="border px-3 py-1 rounded bg-white"
                  value={ui.bagTypes || ''}
                  onChange={(e) =>
                    onChange({
                      ...ui,
                      bagTypes: e.target.value as FiltersValue['bagTypes'],
                    })
                  }
                >
                  <option value="">— Всі —</option>
                  {TYPE_OPTIONS.map((bt) => (
                    <option key={bt} value={bt}>
                      {TYPE_LABELS[bt] ?? bt}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Колір */}
            <div className="flex items-center gap-3 mr-[40px] cursor-pointer">
              <span className="uppercase tracking-wide">Колір:</span>
              <select
                className="border px-3 py-1 rounded bg-white"
                value={ui.color}
                onChange={(e) => onChange({ ...ui, color: e.target.value })}
              >
                <option value="">— Всі —</option>
                {colors.map((c) => (
                  <option key={c} value={c}>
                    {COLOR_LABELS[c] || c}
                  </option>
                ))}
              </select>
            </div>

            {/* Ціна */}
            <div className="flex items-center gap-3">
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
      </div>
    </div>
  )
}
