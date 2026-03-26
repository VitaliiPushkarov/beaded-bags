import { useEffect, useMemo, useState } from 'react'
import {
  Product,
  ProductVariant,
  ProductVariantAddon,
  ProductVariantImage,
} from '@prisma/client'
import { isInStockStatus, resolveAvailabilityStatus } from '@/lib/availability'
import { calcDiscountedPrice } from '@/lib/pricing'

export type AddonVariantUI = ProductVariant & {
  product: Product
  images: ProductVariantImage[]
}

export type VariantWithAddons = ProductVariant & {
  addonsOnVariant?: (ProductVariantAddon & {
    addonVariant: AddonVariantUI
  })[]
}

export function useProductAddons(v: VariantWithAddons | null) {
  const [selectedAddonVariantIds, setSelectedAddonVariantIds] = useState<
    string[]
  >([])

  // скидаємо вибір при зміні варіанту
  useEffect(() => {
    setSelectedAddonVariantIds([])
  }, [v?.id])

  const availableAddons = useMemo(() => {
    if (!v) return []

    const list = (v.addonsOnVariant || [])
      .slice()
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
      .map((rel) => rel.addonVariant)
      .filter((av) => {
        if (!av) return false
        if (av.product?.status !== 'PUBLISHED') return false
        if (!av.product?.inStock) return false

        return isInStockStatus(
          resolveAvailabilityStatus({
            availabilityStatus: (av as any).availabilityStatus,
            inStock: av.inStock,
          }),
        )
      })

    const seen = new Set<string>()
    return list.filter((av) => {
      if (seen.has(av.id)) return false
      seen.add(av.id)
      return true
    })
  }, [v])

  const addonPricing = (av: AddonVariantUI) =>
    calcDiscountedPrice({
      basePriceUAH: av.priceUAH ?? av.product.basePriceUAH ?? 0,
      discountPercent: av.discountPercent,
      discountUAH: av.discountUAH ?? 0,
    })

  const addonPrice = (av: AddonVariantUI) => addonPricing(av).finalPriceUAH

  const addonImageUrl = (av: AddonVariantUI) =>
    av.images?.slice().sort((a, b) => a.sort - b.sort)[0]?.url ||
    av.image ||
    '/img/placeholder.png'

  const addonsTotal = useMemo(() => {
    return availableAddons
      .filter((a) => selectedAddonVariantIds.includes(a.id))
      .reduce((sum, a) => sum + addonPrice(a), 0)
  }, [availableAddons, selectedAddonVariantIds])

  const addonsByVariantId = useMemo(() => {
    const map: Record<string, AddonVariantUI> = {}
    availableAddons.forEach((a) => {
      map[a.id] = a
    })
    return map
  }, [availableAddons])

  const toggleAddon = (addonVariantId: string) => {
    setSelectedAddonVariantIds((prev) =>
      prev.includes(addonVariantId)
        ? prev.filter((id) => id !== addonVariantId)
        : [...prev, addonVariantId]
    )
  }

  return {
    availableAddons,
    selectedAddonVariantIds,
    toggleAddon,
    addonsTotal,
    addonsByVariantId,
    addonPricing,
    addonPrice,
    addonImageUrl,
  }
}
