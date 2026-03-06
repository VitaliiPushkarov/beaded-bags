import type { PrismaClient } from '@prisma/client'

export const CHINA_MARKETPLACE_SUPPLIER_NAME = 'China Marketplace'

export async function ensureChinaMarketplaceSupplier(prisma: PrismaClient) {
  return prisma.supplier.upsert({
    where: { name: CHINA_MARKETPLACE_SUPPLIER_NAME },
    update: {},
    create: {
      name: CHINA_MARKETPLACE_SUPPLIER_NAME,
      currency: 'CNY',
      notes: 'Автоматичний постачальник для закупівель з маркетплейсів Китаю',
    },
  })
}

export const DEFAULT_PACKAGING_TEMPLATE_PRESETS = [
  {
    name: 'Пакування: Велика коробка',
    costUAH: 120,
    boxLabel: 'Велика коробка',
    tissuePaperQty: 2,
    tagCardQty: 1,
    tagThreadQty: 1,
    roundStickerQty: 1,
    squareStickerQty: 1,
    notes: 'Базовий шаблон для великих сумок',
  },
  {
    name: 'Пакування: Середня коробка',
    costUAH: 90,
    boxLabel: 'Середня коробка',
    tissuePaperQty: 2,
    tagCardQty: 1,
    tagThreadQty: 1,
    roundStickerQty: 1,
    squareStickerQty: 1,
    notes: 'Базовий шаблон для середніх товарів',
  },
  {
    name: 'Пакування: Мала коробка',
    costUAH: 65,
    boxLabel: 'Мала коробка',
    tissuePaperQty: 1,
    tagCardQty: 1,
    tagThreadQty: 1,
    roundStickerQty: 1,
    squareStickerQty: 1,
    notes: 'Базовий шаблон для дрібних аксесуарів',
  },
] as const

function roundUAH(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value)
}

export function calculateMaterialsCostFromUsages(
  usages: Array<{ quantity: number; material: { unitCostUAH: number } }>,
): number {
  if (!usages.length) return 0

  return roundUAH(
    usages.reduce((sum, usage) => {
      return sum + Math.max(0, usage.quantity) * Math.max(0, usage.material.unitCostUAH)
    }, 0),
  )
}

export function buildManagedUnitCostUAH(input: {
  profile: {
    materialsCostUAH: number
    laborCostUAH: number
    packagingCostUAH: number
    shippingCostUAH: number
    otherCostUAH: number
  } | null
  materialUsages?: Array<{ quantity: number; material: { unitCostUAH: number } }>
  packagingTemplateCostUAH?: number | null
  includeShipping?: boolean
}): number {
  const profile = input.profile
  const hasUsages = Boolean(input.materialUsages?.length)
  const materialCost = hasUsages
    ? calculateMaterialsCostFromUsages(input.materialUsages ?? [])
    : roundUAH(profile?.materialsCostUAH ?? 0)
  const laborCost = roundUAH(profile?.laborCostUAH ?? 0)
  const packagingCost = roundUAH(
    input.packagingTemplateCostUAH ?? profile?.packagingCostUAH ?? 0,
  )
  const shippingCost = input.includeShipping
    ? roundUAH(profile?.shippingCostUAH ?? 0)
    : 0
  const otherCost = roundUAH(profile?.otherCostUAH ?? 0)

  return materialCost + laborCost + packagingCost + shippingCost + otherCost
}
