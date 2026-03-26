'use client'

import { useEffect, useState, SyntheticEvent } from 'react'
import { useRouter } from 'next/navigation'
import type {
  ProductType,
  ProductGroup,
  ProductStatus,
  AvailabilityStatus,
} from '@prisma/client'
import { isInStockStatus, resolveAvailabilityStatus } from '@/lib/availability'
import { ACTIVE_PRODUCT_TYPES } from '@/lib/labels'

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

type VariantStrapInput = {
  id?: string
  name: string
  extraPriceUAH: string
  sort: string
  imageUrl?: string
}

type VariantPouchInput = {
  id?: string
  color: string
  extraPriceUAH: string
  sort: string
  imageUrl?: string
}

type VariantSizeInput = {
  id?: string
  size: string
  extraPriceUAH: string
  sort: string
  imageUrl?: string
}

type VariantInput = {
  id?: string
  color: string
  modelSize: string
  pouchColor: string
  hex: string
  image: string
  images: string[]
  priceUAH: string
  discountPercent: string
  discountUAH?: string
  shippingNote: string
  availabilityStatus: AvailabilityStatus
  inStock: boolean
  sku: string
  addons?: VariantAddonLinkInput[]
  straps?: VariantStrapInput[]
  pouches?: VariantPouchInput[]
  sizes?: VariantSizeInput[]
}

type ProductFormValues = {
  id?: string
  name: string
  slug: string
  type: ProductType
  status: ProductStatus
  group: ProductGroup | ''
  sortCatalog: string
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
  upsertVariantAddonsBatch?: (input: {
    variantId: string
    addonVariantIds: string[]
    sort?: number
  }) => Promise<VariantAddonLinkInput[]>
  updateVariantAddonSort?: (input: {
    id: string
    sort: number
  }) => Promise<VariantAddonLinkInput>
  deleteVariantAddon?: (input: { id: string }) => Promise<{ ok: true }>
}

const TYPE_OPTIONS: ProductType[] = ACTIVE_PRODUCT_TYPES
const STATUS_OPTIONS: Array<{ value: ProductStatus; label: string }> = [
  { value: 'DRAFT', label: 'Чернетка' },
  { value: 'PUBLISHED', label: 'Опубліковано' },
  { value: 'ARCHIVED', label: 'Архів' },
]

const GROUP_OPTIONS: ProductGroup[] = ['BEADS', 'WEAVING']
const AVAILABILITY_OPTIONS: Array<{
  value: AvailabilityStatus
  label: string
}> = [
  { value: 'IN_STOCK', label: 'Є в наявності' },
  { value: 'PREORDER', label: 'Доступно до передзамовлення' },
  { value: 'OUT_OF_STOCK', label: 'Немає в наявності' },
]

export default function ProductForm({
  initial,
  mode,
  addonVariantOptions,
  upsertVariantAddon,
  upsertVariantAddonsBatch,
  updateVariantAddonSort,
  deleteVariantAddon,
}: Props) {
  const router = useRouter()
  const [values, setValues] = useState<ProductFormValues>(
    initial
      ? {
          ...initial,
          status: initial.status ?? 'DRAFT',
          variants: (initial.variants || []).map((v) => {
            const images = normalizeImages(v.images)
            const seededImages =
              images.length === 0 && v.image ? [v.image] : images
            const main = v.image || seededImages[0] || ''
            const availabilityStatus = resolveAvailabilityStatus({
              availabilityStatus: (v as any).availabilityStatus,
              inStock: v.inStock,
            })
            return {
              ...v,
              modelSize: (v as any).modelSize ?? '',
              pouchColor: (v as any).pouchColor ?? '',
              images: seededImages,
              image: main,
              availabilityStatus,
              inStock: isInStockStatus(availabilityStatus),
              straps: (v.straps || []).map((s) => ({
                id: s.id,
                name: s.name || '',
                extraPriceUAH: String(s.extraPriceUAH ?? ''),
                sort: String(s.sort ?? ''),
                imageUrl: (s as any).imageUrl ?? '',
              })),
              pouches: ((v as any).pouches || []).map((pouch: any) => ({
                id: pouch.id,
                color: pouch.color || '',
                extraPriceUAH: String(pouch.extraPriceUAH ?? ''),
                sort: String(pouch.sort ?? ''),
                imageUrl: pouch.imageUrl ?? '',
              })),
              sizes: ((v as any).sizes || []).map((size: any) => ({
                id: size.id,
                size: size.size || '',
                extraPriceUAH: String(size.extraPriceUAH ?? ''),
                sort: String(size.sort ?? ''),
                imageUrl: size.imageUrl ?? '',
              })),
            }
          }),
        }
      : {
          name: '',
          slug: '',
          type: 'BAG',
          status: 'DRAFT',
          group: '',
          sortCatalog: '',
          basePriceUAH: '',
          description: '',
          inStock: true,
          variants: [
            {
              color: '',
              modelSize: '',
              pouchColor: '',
              hex: '',
              image: '',
              images: [],
              priceUAH: '',
              discountPercent: '',
              discountUAH: '',
              shippingNote: '',
              availabilityStatus: 'IN_STOCK',
              inStock: true,
              sku: '',
              addons: [],
              straps: [],
              pouches: [],
              sizes: [],
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
  const [addonSelectionByVariant, setAddonSelectionByVariant] = useState<
    Record<string, string[]>
  >({})

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
      const nextAvailabilityStatus =
        patch.availabilityStatus ??
        (typeof patch.inStock === 'boolean'
          ? patch.inStock
            ? 'IN_STOCK'
            : 'PREORDER'
          : merged.availabilityStatus)

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

      nextVariants[index] = {
        ...merged,
        images,
        image,
        availabilityStatus: nextAvailabilityStatus,
        inStock: isInStockStatus(nextAvailabilityStatus),
      }
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

  const mergeAddonLinks = (
    existing: VariantAddonLinkInput[],
    incoming: VariantAddonLinkInput[],
  ) => {
    const byAddonVariantId = new Map<string, VariantAddonLinkInput>()

    for (const addon of existing) {
      byAddonVariantId.set(addon.addonVariantId, addon)
    }
    for (const addon of incoming) {
      byAddonVariantId.set(addon.addonVariantId, addon)
    }

    return Array.from(byAddonVariantId.values()).sort(
      (a, b) => (a.sort ?? 0) - (b.sort ?? 0),
    )
  }

  const getVariantSelectionKey = (
    variantId: string | undefined,
    index: number,
  ) => (variantId ? `id:${variantId}` : `idx:${index}`)

  const setVariantStraps = (index: number, nextStraps: VariantStrapInput[]) => {
    setValues((prev) => {
      const nextVariants = [...prev.variants]
      const cur = nextVariants[index]
      if (!cur) return prev
      nextVariants[index] = { ...cur, straps: nextStraps }
      return { ...prev, variants: nextVariants }
    })
  }

  const setVariantPouches = (
    index: number,
    nextPouches: VariantPouchInput[],
  ) => {
    setValues((prev) => {
      const nextVariants = [...prev.variants]
      const cur = nextVariants[index]
      if (!cur) return prev
      nextVariants[index] = { ...cur, pouches: nextPouches }
      return { ...prev, variants: nextVariants }
    })
  }

  const setVariantSizes = (index: number, nextSizes: VariantSizeInput[]) => {
    setValues((prev) => {
      const nextVariants = [...prev.variants]
      const cur = nextVariants[index]
      if (!cur) return prev
      nextVariants[index] = { ...cur, sizes: nextSizes }
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
          modelSize: '',
          pouchColor: '',
          hex: '',
          image: '',
          images: [],
          priceUAH: '',
          discountPercent: '',
          discountUAH: '',
          shippingNote: '',
          availabilityStatus: 'IN_STOCK',
          inStock: true,
          sku: '',
          addons: [],
          straps: [],
          pouches: [],
          sizes: [],
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
        status: values.status,
        sortCatalog: values.sortCatalog ? Number(values.sortCatalog) : 0,
        basePriceUAH: values.basePriceUAH ? Number(values.basePriceUAH) : null,
        offerNote: values.offerNote?.trim() || null,
        variants: values.variants.map((v) => {
          const availabilityStatus = resolveAvailabilityStatus({
            availabilityStatus: v.availabilityStatus,
            inStock: v.inStock,
          })

          return {
            availabilityStatus,
            id: v.id,
            color: v.color,
            modelSize: v.modelSize,
            pouchColor: v.pouchColor,
            hex: v.hex,
            image: v.image,
            images: normalizeImages(v.images),
            priceUAH: v.priceUAH ? Number(v.priceUAH) : null,
            discountPercent: v.discountPercent
              ? Math.max(0, Math.min(100, Number(v.discountPercent)))
              : null,
            discountUAH: v.discountUAH ? Number(v.discountUAH) : null,
            shippingNote: v.shippingNote || null,
            inStock: isInStockStatus(availabilityStatus),
            sku: v.sku,
            straps: (v.straps || [])
              .map((s, idx) => ({
                id: s.id,
                name: s.name.trim(),
                extraPriceUAH: s.extraPriceUAH
                  ? Math.max(0, Number(s.extraPriceUAH))
                  : 0,
                sort: s.sort ? Number(s.sort) : idx,
                imageUrl: s.imageUrl?.trim() || null,
              }))
              .filter((s) => s.name.length > 0),
            pouches: (v.pouches || [])
              .map((pouch, idx) => ({
                id: pouch.id,
                color: pouch.color.trim(),
                extraPriceUAH: pouch.extraPriceUAH
                  ? Math.max(0, Number(pouch.extraPriceUAH))
                  : 0,
                sort: pouch.sort ? Number(pouch.sort) : idx,
                imageUrl: pouch.imageUrl?.trim() || null,
              }))
              .filter((pouch) => pouch.color.length > 0),
            sizes: (v.sizes || [])
              .map((size, idx) => ({
                id: size.id,
                size: size.size.trim(),
                extraPriceUAH: size.extraPriceUAH
                  ? Math.max(0, Number(size.extraPriceUAH))
                  : 0,
                sort: size.sort ? Number(size.sort) : idx,
                imageUrl: size.imageUrl?.trim() || null,
              }))
              .filter((size) => size.size.length > 0),
          }
        }),
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

      router.replace('/admin/products')
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

          <div className="grid gap-4 sm:grid-cols-5">
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
              Статус
              <select
                className="mt-2 w-full border rounded-lg px-3 py-2 text-sm border-blue-300"
                value={values.status}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    status: e.target.value as ProductStatus,
                  }))
                }
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
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

            <label className="block text-sm font-medium">
              Позиція в каталозі
              <input
                className="mt-2 w-full border rounded-lg px-3 py-2 text-sm border-blue-300"
                inputMode="numeric"
                value={values.sortCatalog}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    sortCatalog: e.target.value.replace(/[^\d]/g, ''),
                  }))
                }
                placeholder="0"
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
            const selectionKey = getVariantSelectionKey(v.id, index)
            const existingAddonVariantIds = new Set(
              (v.addons || []).map((addon) => addon.addonVariantId),
            )
            const availableAddonVariantOptions = addonVariantOptions
              ? addonVariantOptions.filter(
                  (opt) => !existingAddonVariantIds.has(opt.id),
                )
              : []
            const availableAddonVariantIds = new Set(
              availableAddonVariantOptions.map((opt) => opt.id),
            )
            const selectedAddonVariantIds = (
              addonSelectionByVariant[selectionKey] || []
            ).filter((addonVariantId) =>
              availableAddonVariantIds.has(addonVariantId),
            )

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
                                const next = images.filter(
                                  (_, idx) => idx !== i,
                                )
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
                  <label className="block text-sm font-medium ">
                    Статус наявності
                    <select
                      className="mt-1 w-full border rounded px-2 py-1 text-sm border-blue-300"
                      value={v.availabilityStatus}
                      onChange={(e) =>
                        onVariantChange(index, {
                          availabilityStatus: e.target
                            .value as AvailabilityStatus,
                        })
                      }
                    >
                      {AVAILABILITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="space-y-2">
                  <div className="border border-blue-100 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div>
                        <div className="text-lg font-medium">Ремінці</div>
                        <div className="text-xs text-gray-500">
                          Додай ремінець і вкажи його націнку в гривнях.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-sm px-3 py-1 rounded border border-blue-700 hover:text-blue-700 bg-blue-700 hover:bg-white text-white cursor-pointer"
                        onClick={() => {
                          const next = [
                            ...(v.straps || []),
                            {
                              name: '',
                              extraPriceUAH: '',
                              imageUrl: '',
                              sort: String((v.straps || []).length),
                            },
                          ]
                          setVariantStraps(index, next)
                        }}
                      >
                        Додати ремінець
                      </button>
                    </div>

                    {(v.straps || []).length === 0 ? (
                      <div className="text-sm text-gray-500">
                        Ще немає ремінців
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="hidden sm:grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_70px] px-1 text-[11px] uppercase tracking-wide text-gray-500">
                          <div>Ремінець</div>
                          <div>Фото (URL)</div>
                          <div>Націнка</div>
                          <div>Позиція</div>
                        </div>
                        {(v.straps || []).map((strap, strapIndex) => (
                          <div
                            key={strap.id || `strap-${strapIndex}`}
                            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_70px]"
                          >
                            <input
                              className="w-full min-w-0 border rounded px-2 py-2 text-sm border-blue-300"
                              placeholder="Назва ремінця"
                              value={strap.name}
                              onChange={(e) => {
                                const next = [...(v.straps || [])]
                                next[strapIndex] = {
                                  ...next[strapIndex],
                                  name: e.target.value,
                                }
                                setVariantStraps(index, next)
                              }}
                            />
                            <input
                              className="w-full min-w-0 border rounded px-2 py-2 text-sm border-blue-300"
                              placeholder="URL фото ремінця"
                              value={strap.imageUrl || ''}
                              onChange={(e) => {
                                const next = [...(v.straps || [])]
                                next[strapIndex] = {
                                  ...next[strapIndex],
                                  imageUrl: e.target.value,
                                }
                                setVariantStraps(index, next)
                              }}
                            />
                            <input
                              className="w-full min-w-0 border rounded px-2 py-2 text-sm border-blue-300 text-center"
                              placeholder="Націнка, грн"
                              inputMode="numeric"
                              value={strap.extraPriceUAH}
                              onChange={(e) => {
                                const next = [...(v.straps || [])]
                                next[strapIndex] = {
                                  ...next[strapIndex],
                                  extraPriceUAH: e.target.value.replace(
                                    /[^\d]/g,
                                    '',
                                  ),
                                }
                                setVariantStraps(index, next)
                              }}
                            />
                            <input
                              className="w-full min-w-0 border rounded px-2 py-2 text-sm border-blue-300 text-center"
                              placeholder="Sort"
                              inputMode="numeric"
                              value={strap.sort}
                              onChange={(e) => {
                                const next = [...(v.straps || [])]
                                next[strapIndex] = {
                                  ...next[strapIndex],
                                  sort: e.target.value.replace(/[^\d]/g, ''),
                                }
                                setVariantStraps(index, next)
                              }}
                            />
                            <button
                              type="button"
                              className="text-sm px-3 py-2 rounded border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white cursor-pointer sm:col-span-4 sm:justify-self-end"
                              onClick={() => {
                                const next = (v.straps || []).filter(
                                  (_, i) => i !== strapIndex,
                                )
                                setVariantStraps(index, next)
                              }}
                            >
                              Видалити
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border border-blue-100 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div>
                        <div className="text-lg font-medium">Мішечки</div>
                        <div className="text-xs text-gray-500">
                          Кольори мішечків для цього варіанту.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-sm px-3 py-1 rounded border border-blue-700 hover:text-blue-700 bg-blue-700 hover:bg-white text-white cursor-pointer"
                        onClick={() => {
                          const next = [
                            ...(v.pouches || []),
                            {
                              color: '',
                              extraPriceUAH: '',
                              imageUrl: '',
                              sort: String((v.pouches || []).length),
                            },
                          ]
                          setVariantPouches(index, next)
                        }}
                      >
                        Додати мішечок
                      </button>
                    </div>

                    {(v.pouches || []).length === 0 ? (
                      <div className="text-sm text-gray-500">
                        Ще немає мішечків
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="hidden sm:grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_70px] px-1 text-[11px] uppercase tracking-wide text-gray-500">
                          <div>Колір</div>
                          <div>Фото (URL)</div>
                          <div>Націнка</div>
                          <div>Позиція</div>
                        </div>
                        {(v.pouches || []).map((pouch, pouchIndex) => (
                          <div
                            key={pouch.id || `pouch-${pouchIndex}`}
                            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_70px]"
                          >
                            <input
                              className="w-full min-w-0 border rounded px-2 py-2 text-sm border-blue-300"
                              placeholder="Колір мішечка"
                              value={pouch.color}
                              onChange={(e) => {
                                const next = [...(v.pouches || [])]
                                next[pouchIndex] = {
                                  ...next[pouchIndex],
                                  color: e.target.value,
                                }
                                setVariantPouches(index, next)
                              }}
                            />
                            <input
                              className="w-full min-w-0 border rounded px-2 py-2 text-sm border-blue-300"
                              placeholder="URL фото мішечка"
                              value={pouch.imageUrl || ''}
                              onChange={(e) => {
                                const next = [...(v.pouches || [])]
                                next[pouchIndex] = {
                                  ...next[pouchIndex],
                                  imageUrl: e.target.value,
                                }
                                setVariantPouches(index, next)
                              }}
                            />
                            <input
                              className="w-full min-w-0 border rounded px-2 py-2 text-sm border-blue-300 text-center"
                              placeholder="Націнка, грн"
                              inputMode="numeric"
                              value={pouch.extraPriceUAH}
                              onChange={(e) => {
                                const next = [...(v.pouches || [])]
                                next[pouchIndex] = {
                                  ...next[pouchIndex],
                                  extraPriceUAH: e.target.value.replace(
                                    /[^\d]/g,
                                    '',
                                  ),
                                }
                                setVariantPouches(index, next)
                              }}
                            />
                            <input
                              className="w-full min-w-0 border rounded px-2 py-2 text-sm border-blue-300 text-center"
                              placeholder="Sort"
                              inputMode="numeric"
                              value={pouch.sort}
                              onChange={(e) => {
                                const next = [...(v.pouches || [])]
                                next[pouchIndex] = {
                                  ...next[pouchIndex],
                                  sort: e.target.value.replace(/[^\d]/g, ''),
                                }
                                setVariantPouches(index, next)
                              }}
                            />
                            <button
                              type="button"
                              className="text-sm px-3 py-2 rounded border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white cursor-pointer sm:col-span-4 sm:justify-self-end"
                              onClick={() => {
                                const next = (v.pouches || []).filter(
                                  (_, i) => i !== pouchIndex,
                                )
                                setVariantPouches(index, next)
                              }}
                            >
                              Видалити
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border border-blue-100 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div>
                        <div className="text-lg font-medium">Розміри</div>
                        <div className="text-xs text-gray-500">
                          Розміри моделі для цього варіанту.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-sm px-3 py-1 rounded border border-blue-700 hover:text-blue-700 bg-blue-700 hover:bg-white text-white cursor-pointer"
                        onClick={() => {
                          const next = [
                            ...(v.sizes || []),
                            {
                              size: '',
                              extraPriceUAH: '',
                              imageUrl: '',
                              sort: String((v.sizes || []).length),
                            },
                          ]
                          setVariantSizes(index, next)
                        }}
                      >
                        Додати розмір
                      </button>
                    </div>

                    {(v.sizes || []).length === 0 ? (
                      <div className="text-sm text-gray-500">
                        Ще немає розмірів
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="hidden sm:grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_70px] px-1 text-[11px] uppercase tracking-wide text-gray-500">
                          <div>Розмір</div>
                          <div>Фото (URL)</div>
                          <div>Націнка</div>
                          <div>Позиція</div>
                        </div>
                        {(v.sizes || []).map((size, sizeIndex) => (
                          <div
                            key={size.id || `size-${sizeIndex}`}
                            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_70px]"
                          >
                            <input
                              className="w-full min-w-0 border rounded px-2 py-2 text-sm border-blue-300"
                              placeholder="Розмір"
                              value={size.size}
                              onChange={(e) => {
                                const next = [...(v.sizes || [])]
                                next[sizeIndex] = {
                                  ...next[sizeIndex],
                                  size: e.target.value,
                                }
                                setVariantSizes(index, next)
                              }}
                            />
                            <input
                              className="w-full min-w-0 border rounded px-2 py-2 text-sm border-blue-300"
                              placeholder="URL фото для розміру"
                              value={size.imageUrl || ''}
                              onChange={(e) => {
                                const next = [...(v.sizes || [])]
                                next[sizeIndex] = {
                                  ...next[sizeIndex],
                                  imageUrl: e.target.value,
                                }
                                setVariantSizes(index, next)
                              }}
                            />
                            <input
                              className="w-full min-w-0 border rounded px-2 py-2 text-sm border-blue-300 text-center"
                              placeholder="Націнка, грн"
                              inputMode="numeric"
                              value={size.extraPriceUAH}
                              onChange={(e) => {
                                const next = [...(v.sizes || [])]
                                next[sizeIndex] = {
                                  ...next[sizeIndex],
                                  extraPriceUAH: e.target.value.replace(
                                    /[^\d]/g,
                                    '',
                                  ),
                                }
                                setVariantSizes(index, next)
                              }}
                            />
                            <input
                              className="w-full min-w-0 border rounded px-2 py-2 text-sm border-blue-300 text-center"
                              placeholder="Sort"
                              inputMode="numeric"
                              value={size.sort}
                              onChange={(e) => {
                                const next = [...(v.sizes || [])]
                                next[sizeIndex] = {
                                  ...next[sizeIndex],
                                  sort: e.target.value.replace(/[^\d]/g, ''),
                                }
                                setVariantSizes(index, next)
                              }}
                            />
                            <button
                              type="button"
                              className="text-sm px-3 py-2 rounded border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white cursor-pointer sm:col-span-4 sm:justify-self-end"
                              onClick={() => {
                                const next = (v.sizes || []).filter(
                                  (_, i) => i !== sizeIndex,
                                )
                                setVariantSizes(index, next)
                              }}
                            >
                              Видалити
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

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
                            Додай додаткові варіанти товарів (addons), а також
                            їх положення (від 0 і вище) в списку.
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
                                        {a.addonColor
                                          ? ` — ${a.addonColor}`
                                          : ''}
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
                                            const next = (
                                              v.addons || []
                                            ).filter((x) => x.id !== a.id)
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

                            <div className="mt-3 space-y-2">
                              <div className="border rounded border-blue-300 p-2 max-h-[240px] overflow-y-auto space-y-1">
                                {availableAddonVariantOptions.length > 0 ? (
                                  availableAddonVariantOptions.map((opt) => {
                                    const checked =
                                      selectedAddonVariantIds.includes(opt.id)

                                    return (
                                      <label
                                        key={opt.id}
                                        className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-blue-50 cursor-pointer"
                                      >
                                        <input
                                          type="checkbox"
                                          className="mt-0.5"
                                          checked={checked}
                                          onChange={(e) => {
                                            const isChecked = e.target.checked
                                            setAddonSelectionByVariant(
                                              (prev) => {
                                                const current = (
                                                  prev[selectionKey] || []
                                                ).filter((id) =>
                                                  availableAddonVariantIds.has(
                                                    id,
                                                  ),
                                                )
                                                const next = isChecked
                                                  ? Array.from(
                                                      new Set([
                                                        ...current,
                                                        opt.id,
                                                      ]),
                                                    )
                                                  : current.filter(
                                                      (id) => id !== opt.id,
                                                    )

                                                return {
                                                  ...prev,
                                                  [selectionKey]: next,
                                                }
                                              },
                                            )
                                          }}
                                        />
                                        <span className="text-sm">
                                          {opt.productName}
                                          {opt.color
                                            ? ` — ${opt.color}`
                                            : ''} · {opt.priceUAH} ₴
                                        </span>
                                      </label>
                                    )
                                  })
                                ) : (
                                  <div className="text-sm text-gray-500">
                                    Немає доступних addons
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                className="text-sm px-3 py-2 rounded border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white cursor-pointer disabled:opacity-50"
                                disabled={!selectedAddonVariantIds.length}
                                onClick={async () => {
                                  if (!selectedAddonVariantIds.length) return
                                  try {
                                    const created = upsertVariantAddonsBatch
                                      ? await upsertVariantAddonsBatch({
                                          variantId: v.id as string,
                                          addonVariantIds:
                                            selectedAddonVariantIds,
                                          sort: 0,
                                        })
                                      : await Promise.all(
                                          selectedAddonVariantIds.map(
                                            (addonVariantId) =>
                                              upsertVariantAddon({
                                                variantId: v.id as string,
                                                addonVariantId,
                                                sort: 0,
                                              }),
                                          ),
                                        )

                                    const next = mergeAddonLinks(
                                      v.addons || [],
                                      created,
                                    )
                                    setVariantAddons(index, next)
                                    setAddonSelectionByVariant((prev) => ({
                                      ...prev,
                                      [selectionKey]: [],
                                    }))
                                  } catch (err) {
                                    console.error(err)
                                  }
                                }}
                              >
                                Додати вибрані addons
                              </button>

                              <div className="text-[11px] text-gray-500">
                                Вибери один або кілька addons чекбоксами і додай
                                їх у цей варіант.
                              </div>
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
