import type {
  AvailabilityStatus,
  ProductGroup,
  ProductType,
} from '@prisma/client'

export type ProductCardVariantImageDTO = {
  url: string
  hover: boolean
  sort: number
}

export type ProductCardVariantDTO = {
  id: string
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
