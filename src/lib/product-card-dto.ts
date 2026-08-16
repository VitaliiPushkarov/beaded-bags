import type {
  AvailabilityStatus,
  ProductGroup,
  ProductType,
} from '@prisma/client'
import { resolveDiscountPercent } from '@/lib/pricing'

export type ProductCardVariantImageDTO = {
  url: string
  hover: boolean
  sort: number
}

export type ProductCardVariantDTO = {
  id: string
  sortCatalog: number | null
  color: string | null
  colorEn: string | null
  hex: string | null
  image: string | null
  priceUAH: number | null
  priceUSD: number | null
  discountPercent: number | null
  discountUAH: number | null
  inStock: boolean
  availabilityStatus: AvailabilityStatus
  images: ProductCardVariantImageDTO[]
}

export type ProductCardDTO = {
  id: string
  slug: string
  name: string
  nameEn: string | null
  type: ProductType
  group: ProductGroup | null
  inStock: boolean
  offerNote: string | null
  offerNoteEn: string | null
  basePriceUAH: number | null
  basePriceUSD: number | null
  variants: ProductCardVariantDTO[]
}

type DiscountableProduct = Pick<ProductCardDTO, 'basePriceUAH'>
type DiscountableVariant = Pick<
  ProductCardVariantDTO,
  'priceUAH' | 'discountPercent' | 'discountUAH'
>

/**
 * Знижка варіанту рахується так само, як її показує картка: ціна варіанту,
 * інакше базова ціна товару. Один предикат на всіх, щоб «товар зі знижкою»
 * і «видима знижка на картці» не розʼїжджались.
 */
export function isDiscountedCardVariant(
  p: DiscountableProduct,
  v: DiscountableVariant,
): boolean {
  return (
    resolveDiscountPercent({
      basePriceUAH: v.priceUAH ?? p.basePriceUAH ?? 0,
      discountPercent: v.discountPercent,
      discountUAH: v.discountUAH ?? 0,
    }) > 0
  )
}

export function findDiscountedCardVariant<V extends DiscountableVariant>(
  p: DiscountableProduct & { variants: V[] },
): V | undefined {
  return p.variants?.find((v) => isDiscountedCardVariant(p, v))
}

export function hasDiscountedCardVariant(
  p: DiscountableProduct & { variants: DiscountableVariant[] },
): boolean {
  return Boolean(findDiscountedCardVariant(p))
}
