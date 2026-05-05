'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type VariantRow = {
  id: string
  label: string
  currentRate: number | null
}

type ArtisanRatesTableFormProps = {
  artisanId: string
  variants: VariantRow[]
  action: (formData: FormData) => void | Promise<void>
}

export default function ArtisanRatesTableForm({
  artisanId,
  variants,
  action,
}: ArtisanRatesTableFormProps) {
  const initialSelected = useMemo(
    () =>
      new Set(
        variants
          .filter((variant) => variant.currentRate != null)
          .map((variant) => variant.id),
      ),
    [variants],
  )

  const initialRates = useMemo(
    () =>
      Object.fromEntries(
        variants.map((variant) => [
          variant.id,
          variant.currentRate != null ? String(variant.currentRate) : '',
        ]),
      ) as Record<string, string>,
    [variants],
  )

  const [selected, setSelected] = useState<Set<string>>(initialSelected)
  const [rates, setRates] = useState<Record<string, string>>(initialRates)

  function toggleVariant(variantId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(variantId)) {
        next.delete(variantId)
      } else {
        next.add(variantId)
      }
      return next
    })
  }

  function setRate(variantId: string, value: string) {
    setRates((prev) => ({
      ...prev,
      [variantId]: value,
    }))
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="artisanId" value={artisanId} />

      <div className="overflow-x-auto rounded-md border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">✓</TableHead>
              <TableHead>Назва варіанту товару</TableHead>
              <TableHead className="w-[220px]">Ставка грн/шт</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map((variant) => {
              const isChecked = selected.has(variant.id)
              return (
                <TableRow
                  key={variant.id}
                  onClick={() => toggleVariant(variant.id)}
                  className={isChecked ? 'bg-slate-50' : ''}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      name="selectedVariantIds"
                      value={variant.id}
                      checked={isChecked}
                      onChange={() => toggleVariant(variant.id)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{variant.label}</div>
                  </TableCell>
                  <TableCell>
                    <Input
                      name={`rate_${variant.id}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={rates[variant.id] ?? ''}
                      onChange={(event) =>
                        setRate(variant.id, event.target.value)
                      }
                      onClick={(event) => event.stopPropagation()}
                      placeholder="450"
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Button type="submit">Додати/оновити</Button>
    </form>
  )
}
