export type ArtisanVariantOption = {
  id: string
  sku: string | null
  color: string | null
  modelSize: string | null
  pouchColor: string | null
  product: {
    name: string
    slug: string
  }
}

export type ArtisanRateTableRow = {
  id: string
  label: string
  currentRate: number | null
}

export function buildArtisanVariantLabel(variant: ArtisanVariantOption): string {
  const detail =
    variant.color?.trim() ||
    variant.modelSize?.trim() ||
    variant.pouchColor?.trim() ||
    variant.sku?.trim() ||
    variant.id.slice(0, 8)

  return `${variant.product.name} (${variant.product.slug}) • ${detail}`
}

export function buildArtisanRateTableRows(input: {
  variants: ArtisanVariantOption[]
  ratesByVariantId: Map<string, { ratePerUnitUAH: number }>
}): ArtisanRateTableRow[] {
  return input.variants
    .map((variant) => ({
      id: variant.id,
      label: buildArtisanVariantLabel(variant),
      currentRate: input.ratesByVariantId.get(variant.id)?.ratePerUnitUAH ?? null,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'uk'))
}

export function parseArtisanRateUpdatesFromFormData(formData: FormData): {
  artisanId: string
  updates: Array<{
    variantId: string
    ratePerUnitUAH: number
  }>
} {
  const artisanId = String(formData.get('artisanId') || '').trim()
  if (!artisanId) {
    throw new Error('Некоректний майстер для додавання ставок')
  }

  const selectedVariantIds = formData
    .getAll('selectedVariantIds')
    .map((value) => String(value).trim())
    .filter(Boolean)

  if (selectedVariantIds.length === 0) {
    throw new Error('Оберіть хоча б один варіант')
  }

  const uniqueVariantIds = Array.from(new Set(selectedVariantIds))
  const updates = uniqueVariantIds.map((variantId) => {
    const rateRaw = String(formData.get(`rate_${variantId}`) || '').trim()
    const rate = Number(rateRaw)

    if (!Number.isInteger(rate) || rate < 1 || rate > 100000) {
      throw new Error(`Некоректна ставка для варіанта ${variantId}`)
    }

    return {
      variantId,
      ratePerUnitUAH: rate,
    }
  })

  return {
    artisanId,
    updates,
  }
}

export type ArtisanProductionSettlementInput = {
  productionId: string
  artisanId: string
  status: 'DEBT' | 'PAID'
  settledAmountUAH: number
}

export function parseArtisanProductionSettlementFromFormData(
  formData: FormData,
): ArtisanProductionSettlementInput {
  const productionId = String(formData.get('productionId') || '').trim()
  const artisanId = String(formData.get('artisanId') || '').trim()

  if (!productionId || !artisanId) {
    throw new Error('Некоректний запис виробітку')
  }

  const statusRaw = String(formData.get('status') || '').trim()
  const status: 'DEBT' | 'PAID' = statusRaw === 'PAID' ? 'PAID' : 'DEBT'

  const settledRaw = String(formData.get('settledAmountUAH') || '').trim()
  const settledAmountUAH = Number.parseInt(settledRaw || '0', 10)
  if (!Number.isInteger(settledAmountUAH) || settledAmountUAH < 0) {
    throw new Error('Некоректна сума погашення')
  }

  return {
    productionId,
    artisanId,
    status,
    settledAmountUAH,
  }
}
