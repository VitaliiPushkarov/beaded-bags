import type {
  Product,
  ProductVariant,
  ProductVariantImage,
  ProductVariantStrap,
  ProductVariantPouch,
  ProductVariantSize,
  ProductVariantAddon,
} from '@prisma/client'
import type { AddonVariantUI } from './useProductAddons'

export type StrapImageUI = { url: string; sort?: number | null }
export type OptionImageUI = { url: string; sort?: number | null }

export type StrapWithImages = ProductVariantStrap & {
  images?: StrapImageUI[]
  extraPriceUAH?: number | null
}

export type PouchWithImages = ProductVariantPouch & {
  images?: OptionImageUI[]
  extraPriceUAH?: number | null
}

export type SizeWithImages = ProductVariantSize & {
  images?: OptionImageUI[]
  extraPriceUAH?: number | null
}

export type VariantWithImagesStrapsAndAddons = ProductVariant & {
  images: ProductVariantImage[]
  straps: StrapWithImages[]
  pouches: PouchWithImages[]
  sizes: SizeWithImages[]
  addonsOnVariant?: (ProductVariantAddon & {
    addonVariant: AddonVariantUI
  })[]
}

export type ProductWithVariants = Product & {
  variants: VariantWithImagesStrapsAndAddons[]
}
