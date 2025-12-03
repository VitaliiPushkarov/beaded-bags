'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { ProductType, ProductGroup } from '@prisma/client'

type VariantInput = {
  id?: string
  color: string
  hex: string
  image: string
  priceUAH: string
  inStock: boolean
  sku: string
}

type ProductFormValues = {
  id?: string
  name: string
  slug: string
  type: ProductType
  group: ProductGroup | ''
  basePriceUAH: string
  description: string
  inStock: boolean
  variants: VariantInput[]
  info?: string
  dimensions?: string
}

type Props = {
  initial?: ProductFormValues
  mode: 'create' | 'edit'
}

const TYPE_OPTIONS: ProductType[] = [
  'BAG',
  'BELT_BAG',
  'BACKPACK',
  'SHOPPER',
  'CASE',
]

const GROUP_OPTIONS: ProductGroup[] = ['BEADS', 'WEAVING']

export default function ProductForm({ initial, mode }: Props) {
  const router = useRouter()
  const [values, setValues] = useState<ProductFormValues>(
    initial ?? {
      name: '',
      slug: '',
      type: 'BAG',
      group: '',
      basePriceUAH: '',
      description: '',
      inStock: true,
      variants: [
        {
          color: '',
          hex: '',
          image: '',
          priceUAH: '',
          inStock: true,
          sku: '',
        },
      ],
    }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onVariantChange = (index: number, patch: Partial<VariantInput>) => {
    setValues((prev) => {
      const nextVariants = [...prev.variants]
      nextVariants[index] = { ...nextVariants[index], ...patch }
      return { ...prev, variants: nextVariants }
    })
  }

  const addVariant = () => {
    setValues((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        { color: '', hex: '', image: '', priceUAH: '', inStock: true, sku: '' },
      ],
    }))
  }

  const removeVariant = (index: number) => {
    setValues((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const body = {
        ...values,
        basePriceUAH: values.basePriceUAH ? Number(values.basePriceUAH) : null,
        variants: values.variants.map((v) => ({
          ...v,
          priceUAH: v.priceUAH ? Number(v.priceUAH) : null,
        })),
      }

      const url =
        mode === 'create'
          ? '/api/admin/products'
          : `/api/admin/products/${values.id}`

      const method = mode === 'create' ? 'POST' : 'PATCH'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const contentType = res.headers.get('content-type') || ''

      let json: { error?: string; id?: string } = {}
      if (contentType.includes('application/json')) {
        json = (await res.json()) as { error?: string; id?: string }
      } else {
        console.error('Non-JSON response on save product', await res.text())
        setError('Сервер повернув неочікувану відповідь')
        return
      }

      if (!res.ok) {
        setError(json.error || 'Помилка збереження')
        return
      }

      router.push('/admin/products')
      router.refresh()
    } catch (err) {
      console.error(err)
      setError('Мережева помилка')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          Назва
          <input
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            required
          />
        </label>

        <label className="block text-sm font-medium">
          Slug (URL)
          <input
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
            value={values.slug}
            onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
            required
          />
        </label>

        <label className="block text-sm font-medium">
          Тип
          <select
            className="mt-1 border rounded px-3 py-2 text-sm"
            value={values.type}
            onChange={(e) =>
              setValues((v) => ({ ...v, type: e.target.value as ProductType }))
            }
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Група
          <select
            className="mt-1 border rounded px-3 py-2 text-sm"
            value={values.group}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                group: e.target.value as ProductGroup,
              }))
            }
          >
            {GROUP_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium">
          Базова ціна (UAH)
          <input
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
            inputMode="numeric"
            value={values.basePriceUAH}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                basePriceUAH: e.target.value.replace(/[^\d]/g, ''),
              }))
            }
          />
        </label>

        <label className="block text-sm font-medium">
          Опис
          <textarea
            className="mt-1 w-full border rounded px-3 py-2 text-sm min-h-20"
            value={values.description}
            onChange={(e) =>
              setValues((v) => ({ ...v, description: e.target.value }))
            }
          />
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.inStock}
            onChange={(e) =>
              setValues((v) => ({ ...v, inStock: e.target.checked }))
            }
          />
          В наявності (загальний прапорець)
        </label>
        <label className="block text-sm font-medium">
          Інфо
          <textarea
            className="mt-1 w-full border rounded px-3 py-2 text-sm min-h-20"
            value={values.info}
            onChange={(e) => setValues((v) => ({ ...v, info: e.target.value }))}
          />
        </label>

        <label className="block text-sm font-medium">
          Заміри
          <textarea
            className="mt-1 w-full border rounded px-3 py-2 text-sm min-h-20"
            value={values.dimensions}
            onChange={(e) =>
              setValues((v) => ({ ...v, dimensions: e.target.value }))
            }
          />
        </label>
      </div>

      {/* Варіанти */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-medium">Варіанти</h2>
          <button
            type="button"
            onClick={addVariant}
            className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
          >
            + Додати варіант
          </button>
        </div>

        <div className="space-y-3">
          {values.variants.map((v, index) => (
            <div
              key={index}
              className="border rounded p-3 grid gap-2 md:grid-cols-2"
            >
              <div className="space-y-2">
                <label className="block text-xs font-medium">
                  Колір (назва)
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm"
                    value={v.color}
                    onChange={(e) =>
                      onVariantChange(index, { color: e.target.value })
                    }
                  />
                </label>
                <label className="block text-xs font-medium">
                  HEX
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm"
                    value={v.hex}
                    onChange={(e) =>
                      onVariantChange(index, { hex: e.target.value })
                    }
                  />
                </label>
                <label className="block text-xs font-medium">
                  SKU
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm"
                    value={v.sku}
                    onChange={(e) =>
                      onVariantChange(index, { sku: e.target.value })
                    }
                  />
                </label>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium">
                  Ціна (UAH)
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm"
                    inputMode="numeric"
                    value={v.priceUAH}
                    onChange={(e) =>
                      onVariantChange(index, {
                        priceUAH: e.target.value.replace(/[^\d]/g, ''),
                      })
                    }
                  />
                </label>
                <label className="block text-xs font-medium">
                  URL зображення
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm"
                    value={v.image}
                    onChange={(e) =>
                      onVariantChange(index, { image: e.target.value })
                    }
                  />
                </label>
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={v.inStock}
                    onChange={(e) =>
                      onVariantChange(index, { inStock: e.target.checked })
                    }
                  />
                  В наявності
                </label>
              </div>

              {values.variants.length > 1 && (
                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Видалити варіант
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-black text-white rounded text-sm hover:bg-[#FF3D8C] transition disabled:opacity-50"
      >
        {saving
          ? 'Збереження…'
          : mode === 'create'
          ? 'Створити товар'
          : 'Зберегти зміни'}
      </button>
    </form>
  )
}
