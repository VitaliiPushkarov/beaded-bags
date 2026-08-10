'use client'

import { useState } from 'react'

import { resolveOptionSwatchColor } from '@/app/products/[slug]/product-options'

import {
  mergePouchStraps,
  type VariantPouchInput,
  type VariantPouchStrapInput,
} from './product-form-shared'

const inputClass =
  'w-full min-w-0 border rounded px-2 py-2 text-sm border-blue-300'
const digitsOnly = (value: string) => value.replace(/[^\d]/g, '')

// One swatch cell, shared by pouches and their straps.
//
// Two things make this more than a bare `type="color"`. First, when no hex is
// stored the shop derives the swatch from the label, so the picker shows that
// derived colour instead of an arbitrary black — what admin sees is what the
// customer gets. Second, a colour input has no empty state and can never go
// back to one, so without the reset button a single accidental pick would lock
// the option out of the label-derived colour for good.
function ColorCell({
  value,
  label,
  onChange,
  ariaLabel,
}: {
  value: string
  label: string
  onChange: (next: string) => void
  ariaLabel: string
}) {
  const stored = value.trim()
  const derived = resolveOptionSwatchColor(label)
  const shown = stored || derived || '#e5e7eb'

  return (
    <div className="flex min-w-0 items-center gap-1">
      <input
        className={`${inputClass} h-[38px] flex-1 p-1`}
        type="color"
        value={shown}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        title={stored ? stored : `${shown} — авто за назвою`}
      />
      <button
        type="button"
        className="shrink-0 rounded border border-blue-300 px-1.5 py-1 text-xs text-gray-500 hover:border-blue-700 hover:text-blue-700 disabled:cursor-default disabled:opacity-30 cursor-pointer"
        onClick={() => onChange('')}
        disabled={!stored}
        title="Скинути на авто (колір за назвою)"
        aria-label="Скинути колір на авто"
      >
        ✕
      </button>
    </div>
  )
}

// Extracted from ProductsForm so the pouch -> strap nesting stays readable.
// When `customizationMode` is on, straps become editable inside each pouch and
// the pouch's price/fiscal fields are hidden: that mode is free by definition,
// so a surcharge or LiqPay ID would only be a way to break it.
export default function VariantPouchesEditor({
  pouches,
  onChange,
  customizationMode,
}: {
  pouches: VariantPouchInput[]
  onChange: (next: VariantPouchInput[]) => void
  customizationMode: boolean
}) {
  const patchPouch = (
    pouchIndex: number,
    patch: Partial<VariantPouchInput>,
  ) => {
    const next = [...pouches]
    next[pouchIndex] = { ...next[pouchIndex], ...patch }
    onChange(next)
  }

  const setStraps = (pouchIndex: number, straps: VariantPouchStrapInput[]) => {
    patchPouch(pouchIndex, { straps })
  }

  const pouchLabel = (pouchIndex: number) =>
    pouches[pouchIndex]?.color.trim() || `Мішечок #${pouchIndex + 1}`

  const copyStrapsInto = (
    targetIndex: number,
    picked: VariantPouchStrapInput[],
  ) => {
    setStraps(
      targetIndex,
      mergePouchStraps(picked, pouches[targetIndex]?.straps ?? []),
    )
  }

  // Same picked straps into every other pouch. The source keeps its own set —
  // that is where they came from.
  const copyStrapsIntoAll = (
    sourceIndex: number,
    picked: VariantPouchStrapInput[],
  ) => {
    onChange(
      pouches.map((pouch, index) =>
        index === sourceIndex
          ? pouch
          : { ...pouch, straps: mergePouchStraps(picked, pouch.straps ?? []) },
      ),
    )
  }

  const addPouch = () => {
    onChange([
      ...pouches,
      {
        color: '',
        hex: '',
        liqpayGoodId: '',
        // Forced to 0 in customisation mode; the field is hidden there.
        extraPriceUAH: customizationMode ? '0' : '',
        imageUrl: '',
        sort: String(pouches.length),
        straps: [],
      },
    ])
  }

  return (
    <div className="border border-blue-100 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <div className="text-lg font-medium">Мішечки</div>
          <div className="text-xs text-gray-500">
            {customizationMode
              ? 'Кольори мішечків. Для кожного мішечка задайте ремінці — покупець обирає колір → мішечок → ремінець.'
              : 'Кольори мішечків для цього варіанту.'}
          </div>
        </div>
        <button
          type="button"
          className="text-sm px-3 py-1 rounded border border-blue-700 hover:text-blue-700 bg-blue-700 hover:bg-white text-white cursor-pointer"
          onClick={addPouch}
        >
          Додати мішечок
        </button>
      </div>

      {pouches.length === 0 ? (
        <div className="text-sm text-gray-500">Ще немає мішечків</div>
      ) : (
        <div className="space-y-4">
          {pouches.map((pouch, pouchIndex) => (
            <div
              key={pouch.id || `pouch-${pouchIndex}`}
              className="rounded border border-blue-100 p-3 space-y-3"
            >
              <div
                className={
                  customizationMode
                    ? 'grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)_70px]'
                    : 'grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_130px_minmax(0,1fr)_110px_70px]'
                }
              >
                <input
                  className={inputClass}
                  placeholder="Колір мішечка"
                  value={pouch.color}
                  onChange={(e) =>
                    patchPouch(pouchIndex, { color: e.target.value })
                  }
                />

                <ColorCell
                  value={pouch.hex || ''}
                  label={pouch.color}
                  onChange={(hex) => patchPouch(pouchIndex, { hex })}
                  ariaLabel="Колір мішечка"
                />

                {!customizationMode && (
                  <input
                    className={`${inputClass} text-center`}
                    placeholder="LiqPay ID (override)"
                    inputMode="numeric"
                    value={pouch.liqpayGoodId}
                    onChange={(e) =>
                      patchPouch(pouchIndex, {
                        liqpayGoodId: digitsOnly(e.target.value),
                      })
                    }
                  />
                )}

                <input
                  className={inputClass}
                  placeholder="URL фото мішечка"
                  value={pouch.imageUrl || ''}
                  onChange={(e) =>
                    patchPouch(pouchIndex, { imageUrl: e.target.value })
                  }
                />

                {!customizationMode && (
                  <input
                    className={`${inputClass} text-center`}
                    placeholder="Націнка, грн"
                    inputMode="numeric"
                    value={pouch.extraPriceUAH}
                    onChange={(e) =>
                      patchPouch(pouchIndex, {
                        extraPriceUAH: digitsOnly(e.target.value),
                      })
                    }
                  />
                )}

                <input
                  className={`${inputClass} text-center`}
                  placeholder="Sort"
                  inputMode="numeric"
                  value={pouch.sort}
                  onChange={(e) =>
                    patchPouch(pouchIndex, { sort: digitsOnly(e.target.value) })
                  }
                />
              </div>

              {customizationMode && (
                <PouchStrapsEditor
                  straps={pouch.straps || []}
                  onChange={(next) => setStraps(pouchIndex, next)}
                  sources={pouches
                    .map((candidate, index) => ({
                      index,
                      label: pouchLabel(index),
                      straps: candidate.straps || [],
                    }))
                    .filter(
                      (candidate) =>
                        candidate.index !== pouchIndex &&
                        candidate.straps.length > 0,
                    )}
                  onCopyHere={(picked) => copyStrapsInto(pouchIndex, picked)}
                  onCopyEverywhere={
                    // Only worth offering when there is a third pouch to reach:
                    // with two, "everywhere" is just "here".
                    pouches.length > 2
                      ? (sourceIndex, picked) =>
                          copyStrapsIntoAll(sourceIndex, picked)
                      : undefined
                  }
                />
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm px-3 py-2 rounded border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white cursor-pointer"
                  onClick={() =>
                    onChange(pouches.filter((_, i) => i !== pouchIndex))
                  }
                >
                  Видалити мішечок
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type StrapSource = {
  index: number
  label: string
  straps: VariantPouchStrapInput[]
}

function PouchStrapsEditor({
  straps,
  onChange,
  sources,
  onCopyHere,
  onCopyEverywhere,
}: {
  straps: VariantPouchStrapInput[]
  onChange: (next: VariantPouchStrapInput[]) => void
  sources: StrapSource[]
  onCopyHere: (picked: VariantPouchStrapInput[]) => void
  onCopyEverywhere?: (
    sourceIndex: number,
    picked: VariantPouchStrapInput[],
  ) => void
}) {
  // Which pouch we are picking from, and which of its straps are ticked.
  // Positions, because a strap typed in this session has no id yet.
  const [pickingFrom, setPickingFrom] = useState<number | null>(null)
  const [picked, setPicked] = useState<number[]>([])

  const source = sources.find((entry) => entry.index === pickingFrom) ?? null
  const pickedStraps = source
    ? picked
        .slice()
        .sort((a, b) => a - b)
        .map((position) => source.straps[position])
        .filter(Boolean)
    : []

  const openSource = (sourceIndex: number) => {
    const next = sources.find((entry) => entry.index === sourceIndex)
    setPickingFrom(sourceIndex)
    // Everything ticked to start with: unticking a couple is less work than
    // ticking six, and this is the set that repeats across pouches.
    setPicked(next ? next.straps.map((_, position) => position) : [])
  }

  const closeSource = () => {
    setPickingFrom(null)
    setPicked([])
  }

  const patchStrap = (
    strapIndex: number,
    patch: Partial<VariantPouchStrapInput>,
  ) => {
    const next = [...straps]
    next[strapIndex] = { ...next[strapIndex], ...patch }
    onChange(next)
  }

  return (
    <div className="rounded border border-dashed border-blue-200 bg-blue-50/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <div className="text-sm font-medium">Ремінці для цього мішечка</div>
          <div className="text-[11px] text-gray-500">
            Напр. «Спортивний», «Casual» або колір.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sources.length > 0 && (
            // Назви й кольори повторюються з мішечка в мішечок — беремо потрібні,
            // а фото лишається за цим мішечком: воно і є те, що відрізняється.
            <select
              className="text-xs px-2 py-1 rounded border border-blue-300 bg-white text-blue-700 cursor-pointer"
              value={pickingFrom === null ? '' : String(pickingFrom)}
              onChange={(e) => {
                if (!e.target.value) closeSource()
                else openSource(Number(e.target.value))
              }}
              title="Обрати ремінці з іншого мішечка (фото не копіюються)"
            >
              <option value="">Взяти ремінці з…</option>
              {sources.map((entry) => (
                <option key={entry.index} value={entry.index}>
                  {entry.label} ({entry.straps.length})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="text-xs px-3 py-1 rounded border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white cursor-pointer"
            onClick={() =>
              onChange([
                ...straps,
                {
                  name: '',
                  hex: '',
                  sort: String(straps.length),
                  mainImageUrl: '',
                },
              ])
            }
          >
            Додати ремінець
          </button>
        </div>
      </div>

      {source && (
        <div className="mb-3 rounded border border-blue-200 bg-white p-2">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="text-xs font-medium">
              Ремінці з «{source.label}» — оберіть, які додати
            </div>
            <div className="flex gap-2 text-[11px] text-blue-700">
              <button
                type="button"
                className="underline cursor-pointer"
                onClick={() =>
                  setPicked(source.straps.map((_, position) => position))
                }
              >
                усі
              </button>
              <button
                type="button"
                className="underline cursor-pointer"
                onClick={() => setPicked([])}
              >
                жодного
              </button>
            </div>
          </div>

          <div className="grid gap-1 sm:grid-cols-2">
            {source.straps.map((strap, position) => {
              const checked = picked.includes(position)

              return (
                <label
                  key={strap.id || `source-strap-${position}`}
                  className="flex min-w-0 items-center gap-2 text-xs cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    checked={checked}
                    onChange={() =>
                      setPicked((current) =>
                        checked
                          ? current.filter((entry) => entry !== position)
                          : [...current, position],
                      )
                    }
                  />
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-gray-300"
                    style={{
                      background:
                        strap.hex?.trim() ||
                        resolveOptionSwatchColor(strap.name) ||
                        '#e5e7eb',
                    }}
                  />
                  <span className="truncate">
                    {strap.name.trim() || `Ремінець #${position + 1}`}
                  </span>
                </label>
              )
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="text-xs px-3 py-1 rounded border border-blue-700 bg-blue-700 text-white hover:bg-white hover:text-blue-700 cursor-pointer disabled:cursor-default disabled:opacity-40"
              disabled={pickedStraps.length === 0}
              onClick={() => {
                onCopyHere(pickedStraps)
                closeSource()
              }}
            >
              Додати сюди ({pickedStraps.length})
            </button>

            {onCopyEverywhere && (
              <button
                type="button"
                className="text-xs px-3 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 cursor-pointer disabled:cursor-default disabled:opacity-40"
                disabled={pickedStraps.length === 0}
                onClick={() => {
                  onCopyEverywhere(source.index, pickedStraps)
                  closeSource()
                }}
                title="Додати обрані ремінці в усі мішечки, крім того, з якого вони взяті"
              >
                Додати в усі мішечки
              </button>
            )}

            <button
              type="button"
              className="text-xs px-2 py-1 text-gray-500 hover:text-blue-700 cursor-pointer"
              onClick={closeSource}
            >
              Скасувати
            </button>

            <span className="text-[11px] text-gray-500">
              Фото не копіюються — їх ви додаєте для кожного мішечка окремо.
            </span>
          </div>
        </div>
      )}

      {straps.length === 0 ? (
        <div className="text-xs text-gray-500">
          Ще немає ремінців для цього мішечка
        </div>
      ) : (
        <div className="space-y-2">
          <div className="hidden sm:grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,1.4fr)_70px_90px] px-1 text-[11px] uppercase tracking-wide text-gray-500">
            <div>Назва</div>
            <div>Колір</div>
            <div>Фото (мішечок + ремінець)</div>
            <div>Позиція</div>
            <div />
          </div>

          {straps.map((strap, strapIndex) => (
            <div
              key={strap.id || `pouch-strap-${strapIndex}`}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,1.4fr)_70px_90px]"
            >
              <input
                className={inputClass}
                placeholder="Спортивний"
                value={strap.name}
                onChange={(e) =>
                  patchStrap(strapIndex, { name: e.target.value })
                }
              />
              <ColorCell
                value={strap.hex || ''}
                label={strap.name}
                onChange={(hex) => patchStrap(strapIndex, { hex })}
                ariaLabel="Колір ремінця"
              />
              <input
                className={inputClass}
                placeholder="URL фото з цим мішечком і ремінцем"
                value={strap.mainImageUrl || ''}
                onChange={(e) =>
                  patchStrap(strapIndex, { mainImageUrl: e.target.value })
                }
              />
              <input
                className={`${inputClass} text-center`}
                placeholder="Sort"
                inputMode="numeric"
                value={strap.sort}
                onChange={(e) =>
                  patchStrap(strapIndex, { sort: digitsOnly(e.target.value) })
                }
              />
              <button
                type="button"
                className="text-xs px-2 py-2 rounded border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white cursor-pointer"
                onClick={() =>
                  onChange(straps.filter((_, i) => i !== strapIndex))
                }
              >
                Видалити
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
