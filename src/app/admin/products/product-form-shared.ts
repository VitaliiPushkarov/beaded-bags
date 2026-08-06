import type {
  AvailabilityStatus,
  ProductGroup,
  ProductStatus,
  ProductType,
} from '@prisma/client'

import { ACTIVE_PRODUCT_TYPES } from '@/lib/labels'

// Shared types, option constants, and the image normalizer for the product
// admin form. Extracted from ProductsForm.tsx to keep that component focused
// on rendering/state.

export const normalizeImages = (input: unknown): string[] => {
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

export type VariantAddonLinkInput = {
  id: string
  sort: number
  addonVariantId: string
  addonProductName: string
  addonProductSlug: string
  addonColor: string
  addonPriceUAH: number
}

export type VariantStrapInput = {
  id?: string
  name: string
  liqpayGoodId: string
  extraPriceUAH: string
  sort: string
  imageUrl?: string
}

export type VariantPouchInput = {
  id?: string
  color: string
  liqpayGoodId: string
  extraPriceUAH: string
  sort: string
  imageUrl?: string
}

export type VariantSizeInput = {
  id?: string
  size: string
  liqpayGoodId: string
  extraPriceUAH: string
  sort: string
  imageUrl?: string
}

export type VariantInput = {
  id?: string
  color: string
  colorEn: string
  modelSize: string
  pouchColor: string
  sortCatalog: string
  hex: string
  image: string
  images: string[]
  priceUAH: string
  priceUSD: string
  discountPercent: string
  discountUAH?: string
  shippingNote: string
  availabilityStatus: AvailabilityStatus
  inStock: boolean
  sku: string
  liqpayGoodId: string
  addons?: VariantAddonLinkInput[]
  straps?: VariantStrapInput[]
  pouches?: VariantPouchInput[]
  sizes?: VariantSizeInput[]
}

export type ProductFormValues = {
  id?: string
  name: string
  nameEn: string
  slug: string
  type: ProductType
  status: ProductStatus
  group: ProductGroup | ''
  sortCatalog: string
  basePriceUAH: string
  basePriceUSD: string
  description: string
  descriptionEn: string
  inStock: boolean
  variants: VariantInput[]
  info?: string
  infoEn?: string
  dimensions?: string
  dimensionsEn?: string
  offerNote?: string
  offerNoteEn?: string
}

export type AddonVariantOption = {
  id: string
  productId: string
  productName: string
  productSlug: string
  color: string
  priceUAH: number
  imageUrl: string
}

export const TYPE_OPTIONS: ProductType[] = ACTIVE_PRODUCT_TYPES
export const STATUS_OPTIONS: Array<{ value: ProductStatus; label: string }> = [
  { value: 'DRAFT', label: 'Чернетка' },
  { value: 'PUBLISHED', label: 'Опубліковано' },
  { value: 'ARCHIVED', label: 'Архів' },
]

// Human-readable name for a variant row, for use in confirmations and labels.
export function describeVariant(
  variant: Pick<VariantInput, 'color' | 'modelSize' | 'pouchColor'>,
  index: number,
): string {
  const parts = [variant.color, variant.modelSize, variant.pouchColor]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))

  return parts.length ? parts.join(' / ') : `Варіант #${index + 1}`
}

// Removing a variant only edits form state; the row is deleted when the product
// is saved. A variant that already has an id exists in the database, and
// ProductVariantInventory, ArtisanRate and ArtisanProduction all cascade off
// ProductVariant — so saving takes the stock count, the pay rates and the
// production/payment history with it. A variant without an id was only ever
// added in this form, so nothing is at stake beyond the fields just typed.
export function buildVariantRemovalConfirmation(
  variant: Pick<VariantInput, 'id' | 'color' | 'modelSize' | 'pouchColor'>,
  index: number,
): string {
  const label = describeVariant(variant, index)

  if (!variant.id) {
    return `Видалити «${label}»? Введені дані буде втрачено.`
  }

  return (
    `Видалити варіант «${label}»?\n\n` +
    'Після збереження товару варіант буде видалено назавжди. Разом із ним ' +
    'зникнуть залишки на складі, ставки майстринь та історія виробництва ' +
    'для цього варіанта.\n\n' +
    'Поки товар не збережено, дію ще можна скасувати — просто не зберігайте зміни.'
  )
}

export const GROUP_OPTIONS: ProductGroup[] = ['BEADS', 'WEAVING']
export const AVAILABILITY_OPTIONS: Array<{
  value: AvailabilityStatus
  label: string
}> = [
  { value: 'IN_STOCK', label: 'Є в наявності' },
  { value: 'PREORDER', label: 'Доступно до передзамовлення' },
  { value: 'OUT_OF_STOCK', label: 'Немає в наявності' },
]
