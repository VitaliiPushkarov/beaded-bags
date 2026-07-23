import { resolveAvailabilityStatus } from '@/lib/availability'
import type { ProductWithVariants } from './productTypes'

// Pure, framework-free helpers for product option/variant handling, extracted
// from ProductInteractive to keep that component focused on rendering/state.

export const EMPTY_OPTION_KEY = '__empty__'

export type CustomizationGalleryTarget = 'pouch' | 'strap' | 'size'

export type SwatchOptionSource = {
  images?: Array<{ url: string; sort?: number | null }>
  mainImageUrl?: string | null
  imageUrl?: string | null
}

export function normalizeOptionValue(value: string | null | undefined): string {
  return (value || '').trim()
}

export function toOptionKey(value: string | null | undefined): string {
  const normalized = normalizeOptionValue(value)
  return normalized || EMPTY_OPTION_KEY
}

export function toOptionLabel(
  value: string | null | undefined,
  fallback: string,
): string {
  const normalized = normalizeOptionValue(value)
  return normalized || fallback
}

export function getVariantIdFromHash(hash: string): string | undefined {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  return params.get('variant') || undefined
}

export function getVariantIdFromLocation(loc: Location): string | undefined {
  const fromQuery = new URLSearchParams(loc.search).get('variant')
  return fromQuery || getVariantIdFromHash(loc.hash)
}

export function availabilityRank(
  variant: ProductWithVariants['variants'][number] | null | undefined,
): number {
  const status = resolveAvailabilityStatus({
    availabilityStatus: (variant as any)?.availabilityStatus,
    inStock: variant?.inStock,
  })
  if (status === 'IN_STOCK') return 0
  if (status === 'PREORDER') return 1
  return 2
}

export function choosePreferredVariant(
  variants: ProductWithVariants['variants'],
): ProductWithVariants['variants'][number] | null {
  if (!variants.length) return null

  return [...variants].sort((a, b) => {
    const rankDiff = availabilityRank(a) - availabilityRank(b)
    if (rankDiff !== 0) return rankDiff

    const sortA = typeof a.sortCatalog === 'number' ? a.sortCatalog : 0
    const sortB = typeof b.sortCatalog === 'number' ? b.sortCatalog : 0
    if (sortA !== sortB) return sortA - sortB

    return a.id.localeCompare(b.id)
  })[0]
}

export function buildVariantSelectionLabel(params: {
  productName: string
  color?: string | null
  size?: string | null
  pouchColor?: string | null
  locale: 'uk' | 'en'
}) {
  const isEn = params.locale === 'en'
  const parts = [
    params.color?.trim(),
    params.size?.trim()
      ? `${isEn ? 'Size' : 'Розмір'}: ${params.size.trim()}`
      : null,
    params.pouchColor?.trim()
      ? `${isEn ? 'Pouch' : 'Мішечок'}: ${params.pouchColor.trim()}`
      : null,
  ].filter((part): part is string => Boolean(part))

  return parts.length
    ? `${params.productName} — ${parts.join(' · ')}`
    : params.productName
}

export function collectOptionImages(option: SwatchOptionSource | null): string[] {
  if (!option) return []

  const fromList = (option.images ?? [])
    .map((img) => ({
      url: (img.url ?? '').trim(),
      sort: typeof img.sort === 'number' ? img.sort : 0,
    }))
    .filter((img) => !!img.url)
    .sort((a, b) => a.sort - b.sort)
    .map((img) => img.url)

  if (fromList.length) return fromList

  const one = (option.mainImageUrl || option.imageUrl || '').trim()
  return one ? [one] : []
}

const COLOR_SWATCH_RULES: Array<[RegExp, string]> = [
  [/чорн|black|графіт|graphite|антрацит|anthracite/, '#111827'],
  [/бі(л|л)|white|молоч|ivory/, '#F8F4EA'],
  [/бордо|burgundy|вишн|cherry/, '#6D1024'],
  [/черв|red/, '#C8202F'],
  [/рож|pink|bubblegum/, '#F7A8C8'],
  [/фіол|бузк|purple|violet|lilac/, '#8B5CF6'],
  [/син|blue|navy/, '#2563EB'],
  [/блак|небес|sky/, '#7DD3FC'],
  [/зел|green|marsh/, '#3F7A4F'],
  [/жовт|yellow|banana/, '#F4C430'],
  [/помар|orange/, '#F97316'],
  [/беж|beige|cream|крем|tan/, '#D8C3A5'],
  [/корич|карам|brown|choco|шоколад/, '#7A4A2A'],
  [/сір|gray|grey/, '#9CA3AF'],
  [/сріб|silver|metal|метал/, '#C0C5CA'],
  [/золот|gold/, '#D4AF37'],
]

export function resolveOptionSwatchColor(label: string | null | undefined) {
  const value = (label || '').trim()
  if (!value) return null

  const hex = value.match(/#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\b/i)
  if (hex) return hex[0]

  const normalized = value.toLowerCase()
  return (
    COLOR_SWATCH_RULES.find(([pattern]) => pattern.test(normalized))?.[1] ??
    null
  )
}

export function optionPreviewImage(option: SwatchOptionSource | null) {
  return collectOptionImages(option)[0] ?? null
}
