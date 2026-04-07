export type QueryParamValue = string | string[] | null | undefined

export const FACETED_QUERY_KEYS = [
  'q',
  'color',
  'type',
  'group',
  'subcategory',
  'inStock',
  'onSale',
  'min',
  'max',
  'sortBase',
  'sortPrice',
] as const

export function pickFirstQueryValue(value: QueryParamValue): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }

  if (Array.isArray(value)) {
    for (const part of value) {
      if (typeof part !== 'string') continue
      const trimmed = part.trim()
      if (trimmed) return trimmed
    }
  }

  return undefined
}

export function hasQueryValue(value: QueryParamValue): boolean {
  return Boolean(pickFirstQueryValue(value))
}

export function hasFacetedQueryParams(
  searchParams: Record<string, QueryParamValue>,
  keys: readonly string[] = FACETED_QUERY_KEYS,
): boolean {
  return keys.some((key) => hasQueryValue(searchParams[key]))
}
