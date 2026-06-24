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

export function buildAverageLaborCostByVariantId(
  rates: Array<{
    variantId: string
    ratePerUnitUAH: number
  }>,
): Map<string, number> {
  const totals = new Map<string, { sum: number; count: number }>()

  for (const rate of rates) {
    const variantId = rate.variantId.trim()
    if (!variantId) continue

    const amount = Number(rate.ratePerUnitUAH)
    if (!Number.isFinite(amount) || amount < 0) continue

    const current = totals.get(variantId) ?? { sum: 0, count: 0 }
    current.sum += amount
    current.count += 1
    totals.set(variantId, current)
  }

  return new Map(
    Array.from(totals.entries()).map(([variantId, total]) => [
      variantId,
      total.count > 0 ? roundUAH(total.sum / total.count) : 0,
    ]),
  )
}

export async function getAverageLaborCostByVariantId(
  prisma: PrismaClient,
  variantIds: string[],
) {
  const uniqueVariantIds = Array.from(
    new Set(variantIds.map((variantId) => variantId.trim()).filter(Boolean)),
  )
  if (uniqueVariantIds.length === 0) {
    return new Map<string, number>()
  }

  const rates = await prisma.artisanRate.findMany({
    where: {
      variantId: {
        in: uniqueVariantIds,
      },
      isActive: true,
      artisan: {
        is: {
          isActive: true,
        },
      },
    },
    select: {
      variantId: true,
      ratePerUnitUAH: true,
    },
  })

  return buildAverageLaborCostByVariantId(rates)
}

function normalizeVariantKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[«»"'`’]/g, '')
    .replace(/[^a-zа-яіїєґ0-9]+/giu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function shouldUsageApplyToVariant(
  usage: { variantColor?: string | null },
  variantColor?: string | null,
): boolean {
  const scopedColor = usage.variantColor?.trim()
  if (!scopedColor) return true
  if (!variantColor?.trim()) return false
  return normalizeVariantKey(scopedColor) === normalizeVariantKey(variantColor)
}

export function calculateMaterialsCostFromUsages(
  usages: Array<{
    quantity: number
    variantColor?: string | null
    notes?: string | null
    material: { unitCostUAH: number }
  }>,
  variantColor?: string | null,
): number {
  if (!usages.length) return 0

  return roundUAH(
    usages.reduce((sum, usage) => {
      if (!shouldUsageApplyToVariant(usage, variantColor)) return sum
      // The admin UI now stores the material scope explicitly in `variantColor`.
      // Legacy import notes may still contain per-variant maps, but using them in
      // runtime calculations causes incorrect costs once materials are edited or
      // applied to all variants via the current UI.
      return sum + Math.max(0, usage.quantity) * Math.max(0, usage.material.unitCostUAH)
    }, 0),
  )
}

export function buildManagedCostBreakdown(input: {
  profile: {
    laborCostUAH: number
    shippingCostUAH: number
    otherCostUAH: number
  } | null
  laborCostUAHOverride?: number | null
  materialUsages?: Array<{
    quantity: number
    variantColor?: string | null
    notes?: string | null
    material: { unitCostUAH: number }
  }>
  packagingTemplateCostUAH?: number | null
  variantColor?: string | null
}) {
  const profile = input.profile
  const materialsCostUAH = calculateMaterialsCostFromUsages(
    input.materialUsages ?? [],
    input.variantColor,
  )
  const laborCostUAH = roundUAH(input.laborCostUAHOverride ?? profile?.laborCostUAH ?? 0)
  const packagingCostUAH = roundUAH(input.packagingTemplateCostUAH ?? 0)
  const shippingCostUAH = roundUAH(profile?.shippingCostUAH ?? 0)
  const otherCostUAH = roundUAH(profile?.otherCostUAH ?? 0)

  const totalWithoutShippingUAH =
    materialsCostUAH + laborCostUAH + packagingCostUAH + otherCostUAH
  const totalWithShippingUAH = totalWithoutShippingUAH + shippingCostUAH

  return {
    materialsCostUAH,
    laborCostUAH,
    packagingCostUAH,
    shippingCostUAH,
    otherCostUAH,
    totalWithoutShippingUAH,
    totalWithShippingUAH,
  }
}

export function buildManagedUnitCostUAH(input: {
  profile: {
    laborCostUAH: number
    shippingCostUAH: number
    otherCostUAH: number
  } | null
  laborCostUAHOverride?: number | null
  materialUsages?: Array<{
    quantity: number
    variantColor?: string | null
    notes?: string | null
    material: { unitCostUAH: number }
  }>
  packagingTemplateCostUAH?: number | null
  includeShipping?: boolean
  variantColor?: string | null
}): number {
  const breakdown = buildManagedCostBreakdown({
    profile: input.profile,
    laborCostUAHOverride: input.laborCostUAHOverride,
    materialUsages: input.materialUsages,
    packagingTemplateCostUAH: input.packagingTemplateCostUAH,
    variantColor: input.variantColor,
  })

  return input.includeShipping
    ? breakdown.totalWithShippingUAH
    : breakdown.totalWithoutShippingUAH
}
