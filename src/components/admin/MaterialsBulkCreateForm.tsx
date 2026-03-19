'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import type { MaterialCategory } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
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
}

type VariantDraft = {
  id: number
  color: string
  stockQty: string
  unitCostUAH: string
}

type MaterialsBulkCreateFormProps = {
  action: (formData: FormData) => void | Promise<void>
  categories: CategoryOption[]
}

export default function MaterialsBulkCreateForm({
  action,
  categories,
}: MaterialsBulkCreateFormProps) {
  const firstCategory = categories[0]
  const [name, setName] = useState('')
  const [category, setCategory] = useState<MaterialCategory>(
    firstCategory.value,
  )
  const [unit, setUnit] = useState(firstCategory.defaultUnit)
  const [unitTouched, setUnitTouched] = useState(false)
  const [variants, setVariants] = useState<VariantDraft[]>([
    { id: 1, color: '', stockQty: '0', unitCostUAH: '0' },
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentCategory = useMemo(
    () => categories.find((entry) => entry.value === category) ?? firstCategory,
    [categories, category, firstCategory],
  )

  function addVariant() {
    setVariants((current) => [
      ...current,
      {
        id: current.length ? current[current.length - 1].id + 1 : 1,
        color: '',
        stockQty: '0',
        unitCostUAH: '0',
      },
    ])
  }

  function removeVariant(id: number) {
    setVariants((current) => {
      if (current.length === 1) return current
      return current.filter((variant) => variant.id !== id)
    })
  }

  function updateVariant(
    id: number,
    patch: Partial<Pick<VariantDraft, 'color' | 'stockQty' | 'unitCostUAH'>>,
  ) {
    setVariants((current) =>
      current.map((variant) =>
        variant.id === id ? { ...variant, ...patch } : variant,
      ),
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
    setCategory(firstCategory.value)
    setUnit(firstCategory.defaultUnit)
    setUnitTouched(false)
    setVariants([{ id: 1, color: '', stockQty: '0', unitCostUAH: '0' }])
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      const formData = new FormData(event.currentTarget)
      await action(formData)
      resetFormState()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_260px_180px]">
        <div className="space-y-1.5">
          <Label htmlFor="material-name">Назва матеріалу</Label>
          <Input
            id="material-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Наприклад, Нитки Macrame 2 мм"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="material-category">Категорія</Label>
          <Select
            id="material-category"
            value={category}
            onChange={(event) => {
              const nextCategory = event.target.value as MaterialCategory
              setCategory(nextCategory)

              if (!unitTouched) {
                const nextDefault =
                  categories.find((entry) => entry.value === nextCategory)
                    ?.defaultUnit ?? ''
                setUnit(nextDefault)
              }
            }}
          >
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
                      updateVariant(variant.id, {
                        stockQty: event.target.value,
                      })
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
                      updateVariant(variant.id, {
                        unitCostUAH: event.target.value,
                      })
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
