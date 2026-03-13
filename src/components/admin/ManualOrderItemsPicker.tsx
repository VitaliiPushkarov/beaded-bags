'use client'

import { useMemo, useState } from 'react'

type VariantOption = {
  id: string
  productName: string
  color: string | null
  imageUrl: string | null
  priceUAH: number
}

type Line = {
  id: string
  variantId: string
  qty: number
}

type Props = {
  options: VariantOption[]
}

function formatUAH(value: number): string {
  return `${Math.round(value || 0).toLocaleString('uk-UA')} ₴`
}

function parseSafeInt(value: string): number {
  if (!value.trim()) return 0
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.round(parsed))
}

function createEmptyLine(id: number): Line {
  return {
    id: `line-${id}`,
    variantId: '',
    qty: 1,
  }
}

function getVariantLabel(option: VariantOption): string {
  return option.color?.trim()
    ? `${option.productName} — ${option.color.trim()}`
    : option.productName
}

export default function ManualOrderItemsPicker({ options }: Props) {
  const [lineCounter, setLineCounter] = useState(2)
  const [lines, setLines] = useState<Line[]>([createEmptyLine(1)])
  const [discountInput, setDiscountInput] = useState('0')

  const optionsById = useMemo(
    () => new Map(options.map((option) => [option.id, option])),
    [options],
  )

  const selectedItems = useMemo(
    () =>
      lines
        .map((line) => {
          const option = optionsById.get(line.variantId)
          if (!option || !line.variantId) return null

          return {
            variantId: line.variantId,
            qty: Math.max(1, line.qty),
            unitPriceUAH: option.priceUAH,
          }
        })
        .filter(
          (
            item,
          ): item is {
            variantId: string
            qty: number
            unitPriceUAH: number
          } => Boolean(item),
        ),
    [lines, optionsById],
  )

  const subtotalUAH = useMemo(
    () =>
      selectedItems.reduce(
        (sum, item) => sum + item.unitPriceUAH * item.qty,
        0,
      ),
    [selectedItems],
  )

  const discountUAH = useMemo(
    () => Math.min(parseSafeInt(discountInput), subtotalUAH),
    [discountInput, subtotalUAH],
  )

  const totalUAH = Math.max(0, subtotalUAH - discountUAH)

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine(lineCounter)])
    setLineCounter((prev) => prev + 1)
  }

  const removeLine = (lineId: string) => {
    setLines((prev) => {
      const next = prev.filter((line) => line.id !== lineId)
      return next.length ? next : [createEmptyLine(lineCounter)]
    })
    setLineCounter((prev) => prev + 1)
  }

  const updateLine = (
    lineId: string,
    patch: Partial<Pick<Line, 'variantId' | 'qty'>>,
  ) => {
    setLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              ...patch,
            }
          : line,
      ),
    )
  }

  const payload = JSON.stringify(
    selectedItems.map((item) => ({
      variantId: item.variantId,
      qty: item.qty,
    })),
  )

  const getSelectableOptions = (lineId: string): VariantOption[] => {
    const usedVariantIds = new Set(
      lines
        .filter((line) => line.id !== lineId)
        .map((line) => line.variantId)
        .filter(Boolean),
    )

    return options.filter((option) => !usedVariantIds.has(option.id))
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="manualItems" value={payload} />
      <input type="hidden" name="discountUAH" value={String(discountUAH)} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="overflow-hidden rounded border bg-white">
          <div className="border-b bg-gray-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
            Товари у замовленні
          </div>

          <div className="hidden border-b bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 md:grid md:grid-cols-[minmax(0,1fr)_120px_100px]">
            <div>Товар</div>
            <div>К-сть</div>
            <div>Дії</div>
          </div>

          <div className="divide-y">
            {lines.map((line) => {
              const selectableOptions = getSelectableOptions(line.id)
              const selectedOption = optionsById.get(line.variantId)
              return (
                <div
                  key={line.id}
                  className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_120px_100px] md:items-center"
                >
                  <label className="block text-xs font-medium text-slate-600 md:text-sm md:font-normal md:text-slate-800">
                    <span className="md:hidden">Товар</span>
                    <div className="relative mt-1 md:mt-0">
                      <span className="pointer-events-none absolute inset-y-0 left-3 my-auto inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-[10px] font-semibold uppercase text-slate-500">
                        {selectedOption?.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={selectedOption.imageUrl}
                            alt={getVariantLabel(selectedOption)}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          '•'
                        )}
                      </span>

                      <select
                        value={line.variantId}
                        onChange={(event) =>
                          updateLine(line.id, { variantId: event.target.value })
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-12 pr-3 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      >
                        <option value="">Оберіть варіант товару</option>
                        {selectableOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {getVariantLabel(option)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>

                  <label className="block text-xs font-medium text-slate-600 md:text-sm md:font-normal md:text-slate-800">
                    <span className="md:hidden">К-сть</span>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={line.qty}
                      onChange={(event) =>
                        updateLine(line.id, {
                          qty: Math.max(1, parseSafeInt(event.target.value)),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 md:mt-0"
                    />
                  </label>

                  <div className="md:self-center">
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="rounded border px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                    >
                      Видалити
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="p-3">
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center justify-center rounded border px-3 py-2 text-xs hover:bg-gray-50"
            >
              + Додати товар
            </button>
          </div>
        </div>

        <div className="self-end space-y-3">
          <div className="rounded border bg-slate-50 p-3">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-600">Сума товарів</span>
                <span className="font-medium text-slate-900">
                  {formatUAH(subtotalUAH)}
                </span>
              </div>

              <label className="block text-xs font-medium text-slate-600">
                Знижка
                <input
                  value={discountInput}
                  onChange={(event) => setDiscountInput(event.target.value)}
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                />
              </label>

              <div className="flex items-center justify-between gap-3 border-t pt-2">
                <span className="text-slate-700">Загальна сума</span>
                <span className="text-base font-semibold text-slate-900">
                  {formatUAH(totalUAH)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={selectedItems.length === 0}
            className="inline-flex w-full items-center justify-center rounded bg-black px-4 py-2.5 text-sm text-white hover:bg-[#FF3D8C] disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            Створити ручне замовлення
          </button>

          {selectedItems.length === 0 ? (
            <p className="text-xs text-red-600">
              Додайте хоча б один товар у dropdown.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
