'use client'

import { useState, SyntheticEvent } from 'react'
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
  images: string[]
  priceUAH: string
  discountUAH: string
  shippingNote: string
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
          images: [],
          priceUAH: '',
          discountUAH: '',
          shippingNote: '',
          inStock: true,
          sku: '',
          addons: [],
        },
      ],
    },
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)

  const onVariantChange = (index: number, patch: Partial<VariantInput>) => {
    setValues((prev) => {
      const nextVariants = [...prev.variants]
      nextVariants[index] = { ...nextVariants[index], ...patch }
      return { ...prev, variants: nextVariants }
    })
  }

  const setVariantAddons = (
    index: number,
    nextAddons: VariantAddonLinkInput[],
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
          images: [],
          priceUAH: '',
          discountUAH: '',
          shippingNote: '',
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
  const uploadVariantImage = async (index: number, file: File) => {
    setError(null)
    setUploadingIndex(index)

    try {
      const url = await uploadToCloudinary(file)
      // set main image
      onVariantChange(index, { image: url })
      // if gallery is empty, seed it with the main image for better UX
      setValues((prev) => {
        const nextVariants = [...prev.variants]
        const cur = nextVariants[index]
        if (!cur) return prev
        if (!cur.images || cur.images.length === 0) {
          nextVariants[index] = { ...cur, images: [url] }
          return { ...prev, variants: nextVariants }
        }
        return prev
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload error'
      setError(msg)
    } finally {
      setUploadingIndex(null)
    }
  }
  const onSubmit = async (e: SyntheticEvent) => {
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
          images: v.images ?? [],
          priceUAH: v.priceUAH ? Number(v.priceUAH) : null,
          discountUAH: v.discountUAH ? Number(v.discountUAH) : null,
          shippingNote: v.shippingNote || null,
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
  const uploadToCloudinary = async (file: File) => {
    const sigRes = await fetch('/api/admin/cloudinary/signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'gerdan/products' }),
    })
    if (!sigRes.ok) throw new Error(await sigRes.text())

    const sig = (await sigRes.json()) as {
      cloudName: string
      apiKey: string
      timestamp: number
      folder: string
      signature: string
    }

    const form = new FormData()
    form.append('file', file)
    form.append('api_key', sig.apiKey)
    form.append('timestamp', String(sig.timestamp))
    form.append('signature', sig.signature)
    form.append('folder', sig.folder)

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
      { method: 'POST', body: form },
    )

    const uploadJson = (await uploadRes.json()) as {
      secure_url?: string
      error?: { message?: string }
    }

    if (!uploadRes.ok || !uploadJson.secure_url) {
      throw new Error(uploadJson.error?.message || 'Upload failed')
    }

    return uploadJson.secure_url
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
              <div className="md:col-span-2 flex items-center justify-between">
                <div className="text-sm font-semibold">
                  Варіант #{index + 1}
                </div>
                <button
                  type="button"
                  className="text-sm px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => removeVariant(index)}
                  disabled={values.variants.length <= 1}
                  title={
                    values.variants.length <= 1
                      ? 'Потрібен мінімум 1 варіант'
                      : 'Видалити варіант'
                  }
                >
                  Видалити
                </button>
              </div>
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
                  Знижка (UAH)
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm"
                    inputMode="numeric"
                    value={v.discountUAH}
                    onChange={(e) =>
                      onVariantChange(index, {
                        discountUAH: e.target.value.replace(/[^\d]/g, ''),
                      })
                    }
                    placeholder="0"
                  />
                </label>

                <label className="block text-xs font-medium">
                  Текст доставки (для цього варіанта)
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm"
                    value={v.shippingNote}
                    onChange={(e) =>
                      onVariantChange(index, { shippingNote: e.target.value })
                    }
                    placeholder="Відправка протягом 1–3 днів"
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
                  <div className="text-[11px] text-gray-500 mt-1">
                    Підтримується локальний шлях типу{' '}
                    <span className="font-mono">/img/...</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="inline-flex items-center px-3 py-1.5 border rounded text-xs cursor-pointer hover:bg-gray-50">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          uploadVariantImage(index, f)
                          e.currentTarget.value = ''
                        }}
                        disabled={uploadingIndex === index}
                      />
                      Завантажити main фото
                    </label>

                    {uploadingIndex === index && (
                      <span className="text-xs text-gray-500">
                        Завантаження…
                      </span>
                    )}
                  </div>
                </label>
                <div className="mt-3 rounded border p-2">
                  <div className="text-xs font-medium mb-2">
                    Галерея фото (для слайдера)
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const input = e.currentTarget
                      const files = Array.from(input.files ?? [])
                      if (!files.length) return

                      input.value = ''
                      ;(async () => {
                        for (const file of files) {
                          const url = await uploadToCloudinary(file)

                          const nextImages = [...(v.images || []), url]

                          onVariantChange(index, {
                            images: nextImages,
                            image: v.image || url,
                          })
                        }
                      })()
                    }}
                    className="text-xs"
                  />

                  {v.images?.length ? (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {v.images.map((url, i) => (
                        <div
                          key={url}
                          className="relative border rounded overflow-hidden"
                        >
                          <img
                            src={url}
                            alt=""
                            className="w-full h-24 object-cover"
                          />
                          <button
                            type="button"
                            className="absolute top-1 right-1 bg-white/90 border rounded px-2 py-0.5 text-xs"
                            onClick={() => {
                              const next = v.images.filter(
                                (_, idx) => idx !== i,
                              )
                              const nextMain =
                                v.image === url ? next[0] || '' : v.image
                              onVariantChange(index, {
                                images: next,
                                image: nextMain,
                              })
                            }}
                          >
                            ×
                          </button>

                          {v.image === url && (
                            <div className="absolute bottom-0 left-0 right-0 text-[10px] bg-black/60 text-white px-1 py-0.5">
                              main
                            </div>
                          )}

                          {v.image !== url && (
                            <button
                              type="button"
                              className="absolute bottom-1 left-1 bg-white/90 border rounded px-2 py-0.5 text-[11px]"
                              onClick={() =>
                                onVariantChange(index, { image: url })
                              }
                            >
                              Зробити main
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-500 mt-2">
                      Ще немає фото в галереї
                    </div>
                  )}
                </div>
                {v.image ? (
                  <div className="mt-2">
                    <div className="text-[11px] text-gray-500 mb-1">
                      Превʼю main фото
                    </div>
                    <img
                      src={v.image}
                      alt=""
                      className="w-full max-w-[220px] h-auto rounded border"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-gray-500">
                    Main фото ще не додано
                  </div>
                )}

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
                                            (e.target as HTMLInputElement)
                                              .value,
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
                                                : x,
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
                                            (x) => x.id !== a.id,
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
                                      created.addonVariantId,
                                  )
                                  const next = [...withoutDup, created].sort(
                                    (a, b) => (a.sort ?? 0) - (b.sort ?? 0),
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
