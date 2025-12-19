'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { ProductType, ProductGroup } from '@prisma/client'

type VariantAddonLinkInput = {
  id: string
  sort: number
  addonVariantId: string
  addonProductName: string
  addonProductSlug: string
  addonColor: string
  addonPriceUAH: number
}

type VariantInput = {
  id?: string
  color: string
  hex: string
  image: string
  priceUAH: string
  inStock: boolean
  sku: string
  addons?: VariantAddonLinkInput[]
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

type AddonVariantOption = {
  id: string
  productId: string
  productName: string
  productSlug: string
  color: string
  priceUAH: number
  imageUrl: string
}

type Props = {
  initial?: ProductFormValues
  mode: 'create' | 'edit'
  addonVariantOptions?: AddonVariantOption[]
  upsertVariantAddon?: (input: {
    variantId: string
    addonVariantId: string
    sort?: number
  }) => Promise<VariantAddonLinkInput>
  updateVariantAddonSort?: (input: {
    id: string
    sort: number
  }) => Promise<VariantAddonLinkInput>
  deleteVariantAddon?: (input: { id: string }) => Promise<{ ok: true }>
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

const GROUP_OPTIONS: ProductGroup[] = ['BEADS', 'WEAVING']

export default function ProductForm({
  initial,
  mode,
  addonVariantOptions,
  upsertVariantAddon,
  updateVariantAddonSort,
  deleteVariantAddon,
}: Props) {
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
          addons: [],
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

  const setVariantAddons = (
    index: number,
    nextAddons: VariantAddonLinkInput[]
  ) => {
    setValues((prev) => {
      const nextVariants = [...prev.variants]
      nextVariants[index] = { ...nextVariants[index], addons: nextAddons }
      return { ...prev, variants: nextVariants }
    })
  }

  const addVariant = () => {
    setValues((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          color: '',
          hex: '',
          image: '',
          priceUAH: '',
          inStock: true,
          sku: '',
          addons: [],
        },
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
        group: values.group || null,
        basePriceUAH: values.basePriceUAH ? Number(values.basePriceUAH) : null,
        variants: values.variants.map((v) => ({
          id: v.id,
          color: v.color,
          hex: v.hex,
          image: v.image,
          priceUAH: v.priceUAH ? Number(v.priceUAH) : null,
          inStock: v.inStock,
          sku: v.sku,
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
                group: e.target.value as ProductGroup | '',
              }))
            }
          >
            <option value="">— Без групи — </option>
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

                {addonVariantOptions &&
                  upsertVariantAddon &&
                  updateVariantAddonSort &&
                  deleteVariantAddon && (
                    <div className="md:col-span-2 mt-3 rounded border p-3">
                      <div className="text-sm font-semibold mb-2">
                        Addons для цього варіанту
                      </div>

                      {!v.id ? (
                        <div className="text-sm text-gray-500">
                          Спочатку збережи товар, щоб зʼявився ID варіанту —
                          тоді можна додавати addons.
                        </div>
                      ) : (
                        <>
                          {(v.addons || []).length > 0 ? (
                            <div className="space-y-2">
                              {(v.addons || [])
                                .slice()
                                .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
                                .map((a) => (
                                  <div
                                    key={a.id}
                                    className="flex items-center gap-2"
                                  >
                                    <div className="flex-1 text-sm">
                                      {a.addonProductName}
                                      {a.addonColor ? ` — ${a.addonColor}` : ''}
                                      <span className="text-gray-500">
                                        {' '}
                                        · {a.addonPriceUAH} ₴
                                      </span>
                                    </div>

                                    <input
                                      className="w-20 border rounded px-2 py-1 text-sm"
                                      type="number"
                                      defaultValue={a.sort ?? 0}
                                      onBlur={async (e) => {
                                        const sort =
                                          Number(
                                            (e.target as HTMLInputElement).value
                                          ) || 0
                                        try {
                                          const updated =
                                            await updateVariantAddonSort({
                                              id: a.id,
                                              sort,
                                            })
                                          const next = (v.addons || []).map(
                                            (x) =>
                                              x.id === updated.id
                                                ? { ...x, sort: updated.sort }
                                                : x
                                          )
                                          setVariantAddons(index, next)
                                        } catch (err) {
                                          console.error(err)
                                        }
                                      }}
                                    />

                                    <button
                                      type="button"
                                      className="text-sm px-2 py-1 rounded border hover:bg-gray-50"
                                      onClick={async () => {
                                        try {
                                          await deleteVariantAddon({ id: a.id })
                                          const next = (v.addons || []).filter(
                                            (x) => x.id !== a.id
                                          )
                                          setVariantAddons(index, next)
                                        } catch (err) {
                                          console.error(err)
                                        }
                                      }}
                                    >
                                      Видалити
                                    </button>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">
                              Ще немає доданих addons
                            </div>
                          )}

                          <div className="mt-3 flex items-center gap-2">
                            <select
                              className="flex-1 border rounded px-2 py-2 text-sm"
                              defaultValue=""
                              onChange={async (e) => {
                                const selectEl =
                                  e.currentTarget as HTMLSelectElement
                                const addonVariantId = selectEl.value
                                if (!addonVariantId) return

                                try {
                                  const created = await upsertVariantAddon({
                                    variantId: v.id as string,
                                    addonVariantId,
                                    sort: 0,
                                  })

                                  const existing = v.addons || []
                                  const withoutDup = existing.filter(
                                    (x) =>
                                      x.addonVariantId !==
                                      created.addonVariantId
                                  )
                                  const next = [...withoutDup, created].sort(
                                    (a, b) => (a.sort ?? 0) - (b.sort ?? 0)
                                  )
                                  setVariantAddons(index, next)
                                } catch (err) {
                                  console.error(err)
                                } finally {
                                  // don't rely on e.currentTarget after awaits
                                  selectEl.value = ''
                                }
                              }}
                            >
                              <option value="">+ Додати addon variant…</option>
                              {addonVariantOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.productName}
                                  {opt.color ? ` — ${opt.color}` : ''} ·{' '}
                                  {opt.priceUAH} ₴
                                </option>
                              ))}
                            </select>

                            <div className="text-xs text-gray-500">
                              sort — через поле вище
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
              </div>
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
