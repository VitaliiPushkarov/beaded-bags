'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import type { MaterialCategory } from '@prisma/client'
import type {
  MaterialNameSuggestion,
  MaterialsBulkCreateActionResult,
} from '@/lib/admin-materials'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type CategoryOption = {
  value: MaterialCategory
  label: string
  defaultUnit: string
  slug: string
}

type VariantDraft = {
  id: number
  color: string
  stockQty: string
  unitCostUAH: string
  totalAmountUAH: string
  calcSource: 'unit' | 'total'
}

type MaterialsBulkCreateFormProps = {
  action: (formData: FormData) => Promise<MaterialsBulkCreateActionResult>
  categories: CategoryOption[]
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function parseNonNegativeNumber(value: string): number {
  const normalized = value.replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

function formatEditableNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  const rounded = Math.round(value * 1000) / 1000
  return String(rounded)
}

export default function MaterialsBulkCreateForm({
  action,
  categories,
}: MaterialsBulkCreateFormProps) {
  const categoryMetaByValue = useMemo(
    () => new Map(categories.map((entry) => [entry.value, entry])),
    [categories],
  )

  const [name, setName] = useState('')
  const [category, setCategory] = useState<MaterialCategory | ''>('')
  const [unit, setUnit] = useState('')
  const [unitTouched, setUnitTouched] = useState(false)
  const [variants, setVariants] = useState<VariantDraft[]>([
    {
      id: 1,
      color: '',
      stockQty: '',
      unitCostUAH: '',
      totalAmountUAH: '',
      calcSource: 'unit',
    },
  ])
  const [submitResult, setSubmitResult] =
    useState<MaterialsBulkCreateActionResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [suggestions, setSuggestions] = useState<MaterialNameSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [hideSuggestionsAfterPick, setHideSuggestionsAfterPick] =
    useState(false)

  const exactMatchSuggestions = useMemo(() => {
    const normalizedName = normalizeText(name)
    if (!normalizedName) return []
    return suggestions.filter((item) => normalizeText(item.name) === normalizedName)
  }, [name, suggestions])

  const canRenderSuggestions =
    !hideSuggestionsAfterPick && !suggestionsLoading && suggestions.length > 0

  useEffect(() => {
    const query = name.trim()

    if (query.length < 2) {
      setSuggestions([])
      setSuggestionsLoading(false)
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      setSuggestionsLoading(true)
      try {
        const params = new URLSearchParams({ q: query })
        if (category) {
          params.set('category', category)
        }
        const response = await fetch(
          `/api/admin/materials/suggest?${params.toString()}`,
          {
            signal: controller.signal,
            cache: 'no-store',
          },
        )
        if (!response.ok) {
          setSuggestions([])
          return
        }

        const data = (await response.json()) as {
          items?: MaterialNameSuggestion[]
        }
        setSuggestions(Array.isArray(data.items) ? data.items : [])
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setSuggestionsLoading(false)
        }
      }
    }, 220)

    return () => {
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [name, category])

  function addVariant() {
    setVariants((current) => [
      ...current,
      {
        id: current.length ? current[current.length - 1].id + 1 : 1,
        color: '',
        stockQty: '',
        unitCostUAH: '',
        totalAmountUAH: '',
        calcSource: 'unit',
      },
    ])
  }

  function removeVariant(id: number) {
    setVariants((current) => {
      if (current.length === 1) return current
      return current.filter((variant) => variant.id !== id)
    })
  }

  function updateVariant(id: number, patch: Partial<VariantDraft>) {
    setVariants((current) =>
      current.map((variant) =>
        variant.id === id ? { ...variant, ...patch } : variant,
      ),
    )
  }

  function updateVariantQuantity(id: number, stockQty: string) {
    setVariants((current) =>
      current.map((variant) => {
        if (variant.id !== id) return variant

        const qty = parseNonNegativeNumber(stockQty)
        if (variant.calcSource === 'total') {
          const total = parseNonNegativeNumber(variant.totalAmountUAH)
          return {
            ...variant,
            stockQty,
            unitCostUAH:
              qty > 0 ? formatEditableNumber(total / qty) : '',
          }
        }

        const unitPrice = parseNonNegativeNumber(variant.unitCostUAH)
        return {
          ...variant,
          stockQty,
          totalAmountUAH: formatEditableNumber(qty * unitPrice),
        }
      }),
    )
  }

  function updateVariantUnitPrice(id: number, unitCostUAH: string) {
    setVariants((current) =>
      current.map((variant) => {
        if (variant.id !== id) return variant
        const qty = parseNonNegativeNumber(variant.stockQty)
        const unitPrice = parseNonNegativeNumber(unitCostUAH)
        return {
          ...variant,
          unitCostUAH,
          totalAmountUAH: formatEditableNumber(qty * unitPrice),
          calcSource: 'unit',
        }
      }),
    )
  }

  function updateVariantTotalAmount(id: number, totalAmountUAH: string) {
    setVariants((current) =>
      current.map((variant) => {
        if (variant.id !== id) return variant
        const qty = parseNonNegativeNumber(variant.stockQty)
        const total = parseNonNegativeNumber(totalAmountUAH)
        return {
          ...variant,
          totalAmountUAH,
          unitCostUAH: qty > 0 ? formatEditableNumber(total / qty) : '',
          calcSource: 'total',
        }
      }),
    )
  }

  const payload = JSON.stringify({
    items: variants.map((variant) => ({
      name,
      category,
      unit,
      color: variant.color,
      stockQty: variant.stockQty,
      unitCostUAH: variant.unitCostUAH,
    })),
  })

  function resetFormState() {
    setName('')
    setCategory('')
    setUnit('')
    setUnitTouched(false)
    setVariants([
      {
        id: 1,
        color: '',
        stockQty: '',
        unitCostUAH: '',
        totalAmountUAH: '',
        calcSource: 'unit',
      },
    ])
    setSuggestions([])
    setHideSuggestionsAfterPick(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    if (!category) {
      setSubmitError('Оберіть категорію матеріалу')
      return
    }

    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const formData = new FormData(event.currentTarget)
      const result = await action(formData)
      setSubmitResult(result)

      if (result.existingCount === 0) {
        resetFormState()
      }
    } catch (error) {
      setSubmitResult(null)
      setSubmitError(
        error instanceof Error ? error.message : 'Не вдалося створити матеріали',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {submitError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      ) : null}

      {submitResult ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <div className="font-medium text-slate-900">Результат додавання</div>
          <div>
            Створено: <span className="font-medium">{submitResult.createdCount}</span>
          </div>
          <div>
            Оновлено в запасах:{' '}
            <span className="font-medium">{submitResult.existingCount}</span>
          </div>

          {submitResult.created.length > 0 ? (
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Створені матеріали
              </div>
              <div className="space-y-1">
                {submitResult.created.map((item) => (
                  <div key={item.id}>
                    <Link href={item.href} className="text-emerald-700 hover:underline">
                      {item.name}
                      {item.color ? ` · ${item.color}` : ' · Без кольору'}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {submitResult.existing.length > 0 ? (
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Оновлені матеріали
              </div>
              <div className="space-y-1">
                {submitResult.existing.map((item) => (
                  <div key={item.id}>
                    <Link href={item.href} className="text-blue-600 hover:underline">
                      {item.name}
                      {item.color ? ` · ${item.color}` : ' · Без кольору'}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_260px_180px]">
        <div className="space-y-1.5">
          <Label htmlFor="material-name">Назва матеріалу</Label>
          <Input
            id="material-name"
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setHideSuggestionsAfterPick(false)
            }}
            placeholder="Наприклад, Нитки Macrame 2 мм"
            autoComplete="off"
          />

          {suggestionsLoading ? (
            <div className="text-xs text-slate-500">Пошук матеріалів...</div>
          ) : null}

          {canRenderSuggestions ? (
            <div className="rounded-md border border-slate-200 bg-white p-1">
              {suggestions.map((item) => (
                <button
                  key={`${item.name}-${item.category}`}
                  type="button"
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-slate-50"
                  onClick={() => {
                    setName(item.name)
                    setHideSuggestionsAfterPick(true)
                    if (category !== item.category) {
                      setCategory(item.category)
                      if (!unitTouched) {
                        setUnit(
                          categoryMetaByValue.get(item.category)?.defaultUnit ??
                            '',
                        )
                      }
                    }
                  }}
                >
                  <span className="font-medium text-slate-800">
                    {item.name}
                  </span>
                  <span className="text-slate-500">
                    {category
                      ? `${item.variantsCount} варіант(ів)`
                      : `${categoryMetaByValue.get(item.category)?.label || item.category} · ${item.variantsCount}`}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {exactMatchSuggestions.length > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-900">
              <div className="font-medium">
                Є матеріали з такою назвою. Після збереження буде оновлено наявний
                запис за збігом назви, категорії та кольору:
              </div>
              <div className="mt-1 space-y-1">
                {exactMatchSuggestions.map((item) => {
                  const categoryMeta = categoryMetaByValue.get(item.category)
                  return (
                    <div key={`${item.name}-${item.category}`}>
                      <span className="text-amber-800">
                        {categoryMeta?.label || item.category}: {' '}
                        {item.colors.length > 0
                          ? item.colors.join(', ')
                          : 'без кольору'}
                      </span>{' '}
                      {categoryMeta ? (
                        <Link
                          href={`/admin/inventory/materials/${categoryMeta.slug}?q=${encodeURIComponent(
                            item.name,
                          )}`}
                          className="font-medium underline underline-offset-2"
                        >
                          Відкрити
                        </Link>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="material-category">Категорія</Label>
          <Select
            id="material-category"
            value={category}
            onChange={(event) => {
              const nextCategory = event.target.value as MaterialCategory | ''
              setCategory(nextCategory)
              setHideSuggestionsAfterPick(false)

              if (!unitTouched) {
                setUnit(
                  nextCategory
                    ? (categoryMetaByValue.get(nextCategory)?.defaultUnit ?? '')
                    : '',
                )
              }
            }}
          >
            <option value="">Оберіть категорію</option>
            {categories.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="material-unit">Одиниця виміру</Label>
          <Input
            id="material-unit"
            value={unit}
            onChange={(event) => {
              setUnitTouched(true)
              setUnit(event.target.value)
            }}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Колір</TableHead>
              <TableHead className="w-36 text-right">Кількість</TableHead>
              <TableHead className="w-36 text-right">Ціна за 1 од.</TableHead>
              <TableHead className="w-40 text-right">Загальна сума</TableHead>
              <TableHead className="w-16 text-right">Дія</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map((variant, index) => (
              <TableRow key={variant.id}>
                <TableCell className="text-center text-xs text-slate-500">
                  {index + 1}
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`Колір варіанту ${index + 1}`}
                    value={variant.color}
                    onChange={(event) =>
                      updateVariant(variant.id, { color: event.target.value })
                    }
                    placeholder={index === 0 ? 'Необовʼязково' : 'Колір'}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`Кількість варіанту ${index + 1}`}
                    type="number"
                    min="0"
                    step="0.001"
                    value={variant.stockQty}
                    onChange={(event) =>
                      updateVariantQuantity(variant.id, event.target.value)
                    }
                    className="text-right"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`Ціна варіанту ${index + 1}`}
                    type="number"
                    min="0"
                    step="0.001"
                    value={variant.unitCostUAH}
                    onChange={(event) =>
                      updateVariantUnitPrice(variant.id, event.target.value)
                    }
                    className="text-right"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`Загальна сума варіанту ${index + 1}`}
                    type="number"
                    min="0"
                    step="0.001"
                    value={variant.totalAmountUAH}
                    onChange={(event) =>
                      updateVariantTotalAmount(variant.id, event.target.value)
                    }
                    className="text-right"
                  />
                </TableCell>
                <TableCell className="text-right">
                  {variants.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariant(variant.id)}
                      title="Прибрати варіант"
                      aria-label="Прибрати варіант"
                    >
                      <Trash2 className="h-4 w-4 text-slate-500" />
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <input type="hidden" name="payload" value={payload} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addVariant}
          disabled={isSubmitting}
          className="cursor-pointer"
        >
          <Plus className="mr-1 h-4 w-4" />
          Додати варіант
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="sm:min-w-44 cursor-pointer"
        >
          {isSubmitting ? 'Збереження...' : 'Додати матеріали'}
        </Button>
      </div>
    </form>
  )
}
