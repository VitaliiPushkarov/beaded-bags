'use client'

import { useMemo, useState } from 'react'

import { TYPE_LABELS } from '@/lib/labels'
import {
  RECOMMENDATION_CATEGORIES,
  isSubcategoryTarget,
  recommendationCellName,
  subcategorySlugOf,
  type RecommendationCategory,
  type RecommendationMatrix,
  type RecommendationTarget,
} from '@/lib/recommendation-matrix'

type Props = {
  initial: RecommendationMatrix
  action: (formData: FormData) => Promise<void>
  saved?: boolean
  // Passed through the form rather than closed over by the action: a server
  // action cannot capture the helper that builds it.
  returnTo: string
  // Column order and labels come from the server so the grid always mirrors the
  // shop's own accessory taxonomy.
  columns: RecommendationTarget[]
  subcategoryLabels: Record<string, string>
}

export default function RecommendationMatrixForm({
  initial,
  action,
  saved,
  returnTo,
  columns,
  subcategoryLabels,
}: Props) {
  const [matrix, setMatrix] = useState<RecommendationMatrix>(initial)
  const [saving, setSaving] = useState(false)

  const emptyRows = useMemo(
    () => RECOMMENDATION_CATEGORIES.filter((row) => matrix[row].length === 0),
    [matrix],
  )

  function columnLabel(column: RecommendationTarget) {
    if (!isSubcategoryTarget(column)) {
      return TYPE_LABELS[column]
    }
    const slug = subcategorySlugOf(column)
    return subcategoryLabels[slug] ?? slug
  }

  function toggle(row: RecommendationCategory, column: RecommendationTarget) {
    setMatrix((current) => {
      const next = new Set<RecommendationTarget>(current[row])
      if (next.has(column)) next.delete(column)
      else next.add(column)

      return {
        ...current,
        [row]: columns.filter((item) => next.has(item)),
      }
    })
  }

  function selectRow(row: RecommendationCategory, all: boolean) {
    setMatrix((current) => ({
      ...current,
      [row]: all ? [...columns] : [],
    }))
  }

  return (
    <form
      action={async (formData) => {
        setSaving(true)
        try {
          await action(formData)
        } finally {
          setSaving(false)
        }
      }}
      className="rounded-lg border border-slate-200 bg-white p-4 space-y-4"
    >
      <input type="hidden" name="returnTo" value={returnTo} />

      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Блок «Вам може сподобатись»
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Рядок — категорія товару, сторінку якого відкрив покупець. Стовпці —
          що можна показати в блоці: спочатку категорії, далі окремі
          підкатегорії аксесуарів (наприклад «Сумки → Брелоки»). Сам товар, який
          відкрито, у блоці ніколи не показується.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Підкатегорії визначаються за назвою товару — тим самим правилом, що й
          сторінки каталогу /shop/accessories. Тому товар може підпасти під дві
          підкатегорії одночасно.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Відкрито товар →<br />
                Показувати ↓
              </th>
              {columns.map((column) => (
                <th
                  key={column}
                  className={`border border-slate-200 px-3 py-2 text-center text-xs font-semibold ${
                    isSubcategoryTarget(column)
                      ? 'bg-slate-100 font-normal text-slate-600'
                      : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  {columnLabel(column)}
                </th>
              ))}
              <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Рядок
              </th>
            </tr>
          </thead>
          <tbody>
            {RECOMMENDATION_CATEGORIES.map((row) => {
              const isEmpty = matrix[row].length === 0

              return (
                <tr key={row}>
                  <th
                    scope="row"
                    className={`border border-slate-200 px-3 py-2 text-left font-medium ${
                      isEmpty
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-white text-slate-900'
                    }`}
                  >
                    {TYPE_LABELS[row]}
                  </th>

                  {columns.map((column) => {
                    const checked = matrix[row].includes(column)

                    return (
                      <td
                        key={column}
                        className={`border border-slate-200 px-3 py-2 text-center ${
                          isSubcategoryTarget(column) ? 'bg-slate-50/60' : ''
                        }`}
                      >
                        <label className="inline-flex cursor-pointer items-center justify-center">
                          <span className="sr-only">
                            {`На сторінці «${TYPE_LABELS[row]}» показувати «${columnLabel(column)}»`}
                          </span>
                          <input
                            type="checkbox"
                            name={recommendationCellName(row, column)}
                            checked={checked}
                            onChange={() => toggle(row, column)}
                            className="h-4 w-4 cursor-pointer"
                          />
                        </label>
                      </td>
                    )
                  })}

                  <td className="border border-slate-200 px-3 py-2 text-center text-xs">
                    <button
                      type="button"
                      onClick={() => selectRow(row, true)}
                      className="text-slate-700 underline"
                    >
                      усі
                    </button>
                    <span className="px-1 text-slate-300">/</span>
                    <button
                      type="button"
                      onClick={() => selectRow(row, false)}
                      className="text-slate-700 underline"
                    >
                      жодної
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {emptyRows.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Блок не показуватиметься на сторінках товарів цих категорій:{' '}
          <span className="font-semibold">
            {emptyRows.map((row) => TYPE_LABELS[row]).join(', ')}
          </span>
          . Якщо це не задумано — поставте хоча б одну галочку в рядку.
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        {saved ? (
          <span className="text-sm text-emerald-700">Збережено.</span>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? 'Збереження…' : 'Зберегти блок рекомендацій'}
        </button>
      </div>
    </form>
  )
}
