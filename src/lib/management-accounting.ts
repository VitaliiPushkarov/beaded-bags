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

function normalizeVariantKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[«»"'`’]/g, '')
    .replace(/[^a-zа-яіїєґ0-9]+/giu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function parseVariantNumberMap(
  notes: string | null | undefined,
  prefix: string,
) {
  if (!notes) return null

  const line = notes
    .split('\n')
    .find((entry) => entry.startsWith(prefix))
  if (line) {
    const raw = line.slice(prefix.length).trim()
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const normalized = new Map<string, number>()

      for (const [key, value] of Object.entries(parsed)) {
        const qty = Number(value)
        if (!Number.isFinite(qty) || qty < 0) continue
        normalized.set(normalizeVariantKey(key), qty)
      }

      return normalized
    } catch {
      return null
    }
  }

  return null
}

function parseVariantQuantityMap(notes: string | null | undefined) {
  const mapped = parseVariantNumberMap(notes, 'variantQtyMap=')
  if (mapped) return mapped
  if (!notes) return null

  // Backward compatibility for older imports where details were stored as:
  // details=Model | Варіант: qty | Model | Варіант: qty
  const detailsLine = notes
    .split('\n')
    .find((entry) => entry.startsWith('details='))
  if (!detailsLine) return null

  const legacyRaw = detailsLine.slice('details='.length)
  const regex = /\|\s*([^|:]+?)\s*:\s*([0-9]+(?:[.,][0-9]+)?)/gu
  const map = new Map<string, number>()

  for (const match of legacyRaw.matchAll(regex)) {
    const variantName = normalizeVariantKey(match[1] ?? '')
    const quantity = Number((match[2] ?? '').replace(',', '.'))
    if (!variantName || !Number.isFinite(quantity) || quantity < 0) continue
    map.set(variantName, quantity)
  }

  return map.size > 0 ? map : null
}

function parseVariantCostFactorMap(notes: string | null | undefined) {
  return parseVariantNumberMap(notes, 'variantCostFactorMap=')
}

function resolveUsageQuantity(
  usage: { quantity: number; notes?: string | null },
  variantColor?: string | null,
): number {
  if (!variantColor) return Math.max(0, usage.quantity)

  const variantMap = parseVariantQuantityMap(usage.notes)
  if (!variantMap || variantMap.size === 0) {
    return Math.max(0, usage.quantity)
  }

  const normalizedVariant = normalizeVariantKey(variantColor)
  const exact = variantMap.get(normalizedVariant)
  if (typeof exact === 'number') {
    return Math.max(0, exact)
  }

  const fallback = variantMap.get(normalizeVariantKey('__default'))
  if (typeof fallback === 'number') {
    return Math.max(0, fallback)
  }

  // If variant map is present but current color has no entry, this material
  // is not used for this variant.
  return 0
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

function resolveUsageCostFactor(
  usage: { notes?: string | null },
  variantColor?: string | null,
): number {
  if (!variantColor) return 1

  const factorMap = parseVariantCostFactorMap(usage.notes)
  if (!factorMap || factorMap.size === 0) {
    return 1
  }

  const normalizedVariant = normalizeVariantKey(variantColor)
  const exact = factorMap.get(normalizedVariant)
  if (typeof exact === 'number' && Number.isFinite(exact) && exact > 0) {
    return exact
  }

  const fallback = factorMap.get(normalizeVariantKey('__default'))
  if (typeof fallback === 'number' && Number.isFinite(fallback) && fallback > 0) {
    return fallback
  }

  return 1
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
      const quantity = resolveUsageQuantity(usage, variantColor)
      const factor = resolveUsageCostFactor(usage, variantColor)
      return sum + quantity * Math.max(0, usage.material.unitCostUAH) * factor
    }, 0),
  )
}

export function buildManagedCostBreakdown(input: {
  profile: {
    laborCostUAH: number
    shippingCostUAH: number
    otherCostUAH: number
  } | null
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
  const laborCostUAH = roundUAH(profile?.laborCostUAH ?? 0)
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
    materialUsages: input.materialUsages,
    packagingTemplateCostUAH: input.packagingTemplateCostUAH,
    variantColor: input.variantColor,
  })

  return input.includeShipping
    ? breakdown.totalWithShippingUAH
    : breakdown.totalWithoutShippingUAH
}
