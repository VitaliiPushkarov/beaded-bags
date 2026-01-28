import type {
  Product,
  ProductVariant,
  ProductVariantImage,
  ProductVariantStrap,
  ProductVariantAddon,
} from '@prisma/client'
import type { AddonVariantUI } from './useProductAddons'

export type StrapImageUI = { url: string; sort?: number | null }

export type StrapWithImages = ProductVariantStrap & {
  images?: StrapImageUI[]
}

export type VariantWithImagesStrapsAndAddons = ProductVariant & {
  images: ProductVariantImage[]
  straps: StrapWithImages[]
  addonsOnVariant?: (ProductVariantAddon & {
    addonVariant: AddonVariantUI
  })[]
}

export type ProductWithVariants = Product & {
  variants: VariantWithImagesStrapsAndAddons[]
}
