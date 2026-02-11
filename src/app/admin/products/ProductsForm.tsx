'use client'

import { useEffect, useState, SyntheticEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { ProductType, ProductGroup } from '@prisma/client'

const normalizeImages = (input: unknown): string[] => {
  if (!input) return []

  // already string[]
  if (Array.isArray(input) && input.every((x) => typeof x === 'string')) {
    return (input as string[]).filter(Boolean)
  }

  // array of objects (Prisma relation)
  if (Array.isArray(input)) {
    return (input as any[])
      .map((x) => {
        if (typeof x === 'string') return x
        if (x && typeof x === 'object') {
          return (
            x.url ||
            x.secure_url ||
            x.src ||
            x.imageUrl ||
            x.path ||
            x.publicUrl ||
            ''
          )
        }
        return ''
      })
      .filter(Boolean)
  }

  // string: JSON array or comma/newline separated
  if (typeof input === 'string') {
    const s = input.trim()
    if (!s) return []
    try {
      const parsed = JSON.parse(s)
      return normalizeImages(parsed)
    } catch {
      return s
        .split(/\s*,\s*|\n+/)
        .map((x) => x.trim())
        .filter(Boolean)
    }
  }

  return []
}

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
  discountPercent: string
  discountUAH?: string
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
  offerNote?: string
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
    initial
      ? {
          ...initial,
          variants: (initial.variants || []).map((v) => {
            const images = normalizeImages(v.images)
            const seededImages = images.length === 0 && v.image ? [v.image] : images
            const main = v.image || seededImages[0] || ''
            return { ...v, images: seededImages, image: main }
          }),
        }
      : {
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
          discountPercent: '',
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
  const [dragImg, setDragImg] = useState<{
    variantIndex: number
    imgIndex: number
  } | null>(null)
  const [dragOver, setDragOver] = useState<{
    variantIndex: number
    imgIndex: number
  } | null>(null)

  // Normalize variant images on edit:
  // - ensure `images` is always an array
  // - if `images` is empty but `image` exists, seed gallery with main image
  // - if `image` is empty but `images` has items, set main to the first image
  useEffect(() => {
    setValues((prev) => {
      const nextVariants = prev.variants.map((v) => {
        const images = normalizeImages(v.images)
        const seededImages = images.length === 0 && v.image ? [v.image] : images

        const main = v.image || seededImages[0] || ''

        // return same object if nothing changes (avoid rerenders)
        if (v.images === seededImages && v.image === main) {
          return v
        }

        return {
          ...v,
          images: seededImages,
          image: main,
        }
      })

      // If no variant changed, return prev
      const changed = nextVariants.some((v, i) => v !== prev.variants[i])
      if (!changed) return prev

      return { ...prev, variants: nextVariants }
    })
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onVariantChange = (index: number, patch: Partial<VariantInput>) => {
    setValues((prev) => {
      const nextVariants = [...prev.variants]
      const cur = nextVariants[index]
      if (!cur) return prev

      const merged = { ...cur, ...patch }

      // Normalize images/main relationship
      const images = normalizeImages(merged.images)
      let image = merged.image || ''

      // If current main was removed from images, fallback to first image
      if (image && images.length > 0 && !images.includes(image)) {
        image = images[0] || ''
      }

      // If main is empty but images exist, set main
      if (!image && images.length > 0) {
        image = images[0] || ''
      }

      nextVariants[index] = { ...merged, images, image }
      return { ...prev, variants: nextVariants }
    })
  }

  const setVariantAddons = (
    index: number,
    nextAddons: VariantAddonLinkInput[],
  ) => {
    setValues((prev) => {
      const nextVariants = [...prev.variants]
      const cur = nextVariants[index]
      if (!cur) return prev
      nextVariants[index] = { ...cur, addons: nextAddons }
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
          discountPercent: '',
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
  const onSubmit = async (e: SyntheticEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const body = {
        ...values,
        group: values.group || null,
        basePriceUAH: values.basePriceUAH ? Number(values.basePriceUAH) : null,
        offerNote: values.offerNote?.trim() || null,
        variants: values.variants.map((v) => ({
          id: v.id,
          color: v.color,
          hex: v.hex,
          image: v.image,
          images: normalizeImages(v.images),
          priceUAH: v.priceUAH ? Number(v.priceUAH) : null,
          discountPercent: v.discountPercent
            ? Math.max(0, Math.min(100, Number(v.discountPercent)))
            : null,
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

  const reorder = <T,>(arr: T[], from: number, to: number) => {
    const next = [...arr]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    return next
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 sm:space-y-8 ">
      <div className=" bg-white p-4 sm:p-6 space-y-6">
        {/*  <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold">Товар</h1>
            <p className="text-xs text-gray-500 mt-1">
              Основні налаштування товару: назва, URL, тип, група та базова ціна
            </p>
          </div>
        </div> */}

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Назва
              <input
                className="mt-2 w-full border rounded-lg px-3 py-2 text-sm border-blue-300"
                value={values.name}
                onChange={(e) =>
                  setValues((v) => ({ ...v, name: e.target.value }))
                }
                required
              />
            </label>

            <label className="block text-sm font-medium">
              Slug (URL)
              <input
                className="mt-2 w-full border rounded-lg px-3 py-2 text-sm border-blue-300"
                value={values.slug}
                onChange={(e) =>
                  setValues((v) => ({ ...v, slug: e.target.value }))
                }
                required
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium">
              Тип
              <select
                className="mt-2 w-full border rounded-lg px-3 py-2 text-sm border-blue-300"
                value={values.type}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    type: e.target.value as ProductType,
                  }))
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
                className="mt-2 w-full border rounded-lg px-3 py-2 text-sm border-blue-300"
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
                className="mt-2 w-full border rounded-lg px-3 py-2 text-sm border-blue-300"
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Опис
              <textarea
                className="mt-2 w-full border rounded-lg px-3 py-2 text-sm min-h-64 border-blue-300"
                value={values.description}
                onChange={(e) =>
                  setValues((v) => ({ ...v, description: e.target.value }))
                }
              />
            </label>

            <div className="grid gap-4">
              <label className="inline-flex items-center gap-2 text-sm font-medium mt-1 ">
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
                  className="mt-2 w-full border rounded-lg px-3 py-2 text-sm min-h-20 border-blue-300"
                  value={values.info}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, info: e.target.value }))
                  }
                />
              </label>

              <label className="block text-sm font-medium">
                Заміри
                <textarea
                  className="mt-2 w-full border rounded-lg px-3 py-2 text-sm min-h-20 border-blue-300"
                  value={values.dimensions}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, dimensions: e.target.value }))
                  }
                />
              </label>

              <label className="block text-sm font-medium">
                Текст акції під ціною
                <input
                  className="mt-2 w-full border rounded-lg px-3 py-2 text-sm border-blue-300"
                  value={values.offerNote || ''}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, offerNote: e.target.value }))
                  }
                  placeholder="Пропозиція діє до ..."
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Варіанти */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <h2 className="font-semibold text-2xl">Варіанти</h2>
          <button
            type="button"
            onClick={addVariant}
            className="w-full sm:w-auto text-sm px-3 py-2 sm:py-1 border rounded hover:bg-gray-50 bg-blue-700 text-white hover:text-black cursor-pointer"
          >
            Додати варіант
          </button>
        </div>

        <div className="space-y-3">
          {values.variants.map((v, index) => {
            const images = normalizeImages(v.images)

            return (
              <div
                key={index}
                className="p-4 sm:p-6 grid gap-4 sm:gap-6 gap-y-8 sm:gap-y-10 md:grid-cols-2 bg-white"
              >
                <div className="md:col-span-2 flex items-center justify-between">
                <div className="text-sm font-light">Варіант #{index + 1}</div>
                <button
                  type="button"
                  className="text-sm px-2 py-1 rounded border  disabled:opacity-50 text-blue-700 border-blue-700 hover:bg-blue-700 hover:text-white cursor-pointer"
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

              <div className="space-y-2 md:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xl font-medium">Галерея фото</div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      Перетягуй фото, щоб змінити порядок. Натисни “Зробити
                      main”, щоб змінити головне фото.
                    </div>
                  </div>

                  <label
                    htmlFor={`variant-${index}-gallery-upload`}
                    className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 bg-blue-700 text-white hover:text-black cursor-pointer"
                  >
                    Вибрати файли
                  </label>

                  <input
                    id={`variant-${index}-gallery-upload`}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={async (e) => {
                      const input = e.currentTarget
                      const files = Array.from(input.files ?? [])
                      if (!files.length) return

                      // reset immediately so the same file can be selected again
                      input.value = ''

                      try {
                        setUploadingIndex(index)

                        const uploadedUrls: string[] = []
                        for (const file of files) {
                          const url = await uploadToCloudinary(file)
                          uploadedUrls.push(url)
                        }

                        setValues((prev) => {
                          const nextVariants = [...prev.variants]
                          const cur = nextVariants[index]
                          if (!cur) return prev

                          const prevImages = normalizeImages(cur.images)
                          const merged = [...prevImages, ...uploadedUrls]

                          nextVariants[index] = {
                            ...cur,
                            images: merged,
                            image: cur.image || merged[0] || '',
                          }

                          return { ...prev, variants: nextVariants }
                        })
                      } catch (err) {
                        const msg =
                          err instanceof Error ? err.message : 'Upload error'
                        setError(msg)
                      } finally {
                        setUploadingIndex(null)
                      }
                    }}
                  />
                </div>

                {uploadingIndex === index && (
                  <div className="mt-3 text-sm text-gray-600">
                    Завантаження фото…
                  </div>
                )}

                {images.length ? (
                  <div className="mt-4 grid  sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
                    {images.map((url, i) => {
                      const isDragOver =
                        dragOver?.variantIndex === index &&
                        dragOver?.imgIndex === i

                      return (
                        <div
                          key={`${url}-${i}`}
                          className={`relative overflow-hidden cursor-move bg-white transition ${
                            isDragOver
                              ? 'ring-2 ring-black'
                              : 'hover:ring-2 hover:ring-gray-300'
                          }`}
                          draggable
                          onDragStart={() => {
                            setDragImg({ variantIndex: index, imgIndex: i })
                            setDragOver({ variantIndex: index, imgIndex: i })
                          }}
                          onDragEnter={() => {
                            if (!dragImg) return
                            if (dragImg.variantIndex !== index) return
                            setDragOver({ variantIndex: index, imgIndex: i })
                          }}
                          onDragLeave={() => {
                            setDragOver(null)
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (!dragImg) return
                            if (dragImg.variantIndex !== index) return

                            const from = dragImg.imgIndex
                            const to = i
                            if (from === to) {
                              setDragImg(null)
                              setDragOver(null)
                              return
                            }

                            const next = [...images]
                            const [moved] = next.splice(from, 1)
                            next.splice(to, 0, moved)

                            onVariantChange(index, {
                              images: next,
                              // keep current main URL, but the preview will update if main changes
                              image: v.image,
                            })

                            setDragImg(null)
                            setDragOver(null)
                          }}
                          onDragEnd={() => {
                            setDragImg(null)
                            setDragOver(null)
                          }}
                          title="Перетягни, щоб змінити порядок"
                        >
                          <img
                            src={url}
                            alt=""
                            className="w-full h-56 md:h-64 object-cover"
                            loading="lazy"
                          />

                          <button
                            type="button"
                            className="absolute top-2 right-2 bg-white/95 border rounded-md px-2 py-0.5 text-sm  cursor-pointer border-blue-700 text-blue-700 hover:text-white hover:bg-blue-700 "
                            onClick={() => {
                              const next = images.filter((_, idx) => idx !== i)
                              const nextMain =
                                v.image === url ? next[0] || '' : v.image
                              onVariantChange(index, {
                                images: next,
                                image: nextMain,
                              })
                            }}
                            aria-label="Видалити фото"
                          >
                            ×
                          </button>

                          {v.image === url ? (
                            <div className="absolute bottom-0 left-0 right-0 text-[11px] bg-black/65 text-white px-2 py-1">
                              main
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="absolute bottom-2 left-2 bg-white/95 border rounded-md px-2 py-1 text-[11px] cursor-pointer border-blue-700 text-blue-700 hover:text-white hover:bg-blue-700 "
                              onClick={() =>
                                onVariantChange(index, { image: url })
                              }
                            >
                              Зробити main
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 mt-4">
                    Ще немає фото в галереї
                  </div>
                )}
              </div>
              {/* {v.image ? (
                  <div className="mt-2">
                    <div className="text-[11px] text-gray-500 mb-1">
                      Превʼю main фото
                    </div>
                    <img
                      src={v.image}
                      alt=""
                      className="w-full max-w-[160px] h-auto rounded border"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-gray-500">
                    Main фото ще не додано
                  </div>
                )} */}
              <div className="space-y-2">
                <div className="text-xl font-medium mb-3">Інформація</div>
                <label className="block text-sm font-medium ">
                  Колір (назва)
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm border-blue-300"
                    value={v.color}
                    onChange={(e) =>
                      onVariantChange(index, { color: e.target.value })
                    }
                  />
                </label>
                <label className="block text-sm font-medium ">
                  HEX
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm border-blue-300"
                    value={v.hex}
                    onChange={(e) =>
                      onVariantChange(index, { hex: e.target.value })
                    }
                  />
                </label>
                <label className="block text-sm font-medium ">
                  SKU
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm border-blue-300"
                    value={v.sku}
                    onChange={(e) =>
                      onVariantChange(index, { sku: e.target.value })
                    }
                  />
                </label>
                <label className="block text-sm font-medium ">
                  Ціна (UAH)
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm border-blue-300"
                    inputMode="numeric"
                    value={v.priceUAH}
                    onChange={(e) =>
                      onVariantChange(index, {
                        priceUAH: e.target.value.replace(/[^\d]/g, ''),
                      })
                    }
                  />
                </label>

                <label className="block text-sm font-medium ">
                  Знижка (%)
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm border-blue-300"
                    inputMode="numeric"
                    value={v.discountPercent}
                    onChange={(e) =>
                      onVariantChange(index, {
                        discountPercent: e.target.value.replace(/[^\d]/g, ''),
                      })
                    }
                    placeholder="0"
                  />
                </label>

                <label className="block text-sm font-medium ">
                  Текст доставки (для цього варіанта)
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm border-blue-300"
                    value={v.shippingNote}
                    onChange={(e) =>
                      onVariantChange(index, { shippingNote: e.target.value })
                    }
                    placeholder="Відправка протягом 1–3 днів"
                  />
                </label>

                <label className="block text-xs font-medium ">
                  URL зображення
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm border-blue-300"
                    value={v.image}
                    onChange={(e) =>
                      onVariantChange(index, { image: e.target.value })
                    }
                  />
                  <div className="text-[11px] text-gray-500 mt-1">
                    Підтримується локальний шлях типу{' '}
                    <span className="font-mono">/img/...</span>
                  </div>
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
              <div className="space-y-2">
                {addonVariantOptions &&
                  upsertVariantAddon &&
                  updateVariantAddonSort &&
                  deleteVariantAddon && (
                    <div className="md:col-span-2">
                      <div className="mb-6">
                        <div className="text-xl font-medium mb-1">
                          Addons для цього варіанту
                        </div>
                        <div className="text-xs text-gray-500 mb-3">
                          Додай додаткові варіанти товарів (addons), а також їх
                          положення (від 0 і вище) в списку.
                        </div>
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
                                    className="flex flex-col sm:flex-row sm:items-center gap-2"
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
                                      className="w-full sm:w-16 border rounded px-2 py-2 sm:py-1 text-sm border-blue-300 text-center"
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
                                      className="w-full sm:w-auto text-sm px-3 py-2 sm:px-2 sm:py-1 rounded border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white cursor-pointer"
                                      onClick={async () => {
                                        try {
                                          await deleteVariantAddon({
                                            id: a.id,
                                          })
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
                              className="flex-1 border rounded px-2 py-2 text-sm border-blue-300"
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
                              <option value="">Додати addon variant…</option>
                              {addonVariantOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.productName}
                                  {opt.color ? ` — ${opt.color}` : ''} ·{' '}
                                  {opt.priceUAH} ₴
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  )}
              </div>
            </div>
            )
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="fixed bottom-0 inset-x-0 z-40 border-t mb-0 sm:mb-auto bg-white/95 backdrop-blur px-4 py-3 sm:static sm:border-0 sm:bg-transparent sm:backdrop-blur-0 sm:px-0 sm:py-0">
        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-black text-white rounded text-sm hover:bg-[#FF3D8C] transition disabled:opacity-50"
        >
          {saving
            ? 'Збереження…'
            : mode === 'create'
              ? 'Створити товар'
              : 'Зберегти зміни'}
        </button>
      </div>
      <div className="h-20 sm:hidden" />
    </form>
  )
}
