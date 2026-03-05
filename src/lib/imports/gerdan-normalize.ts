import type { ProductCostStageRow } from './gerdan-types'

const CYRILLIC_X = /[хХ]/g
const MULTIPLIERS = /[×xX]/g
const NBSP = /\u00A0/g
const PUNCTUATION = /[()[\]{}"'`.,;:!?/+\\|]+/g
const SPACES = /\s+/g

const MONTHS_UA: Record<string, number> = {
  січень: 1,
  лютий: 2,
  березень: 3,
  квітень: 4,
  травень: 5,
  червень: 6,
  липень: 7,
  серпень: 8,
  вересень: 9,
  жовтень: 10,
  листопад: 11,
  грудень: 12,
}

export function cleanString(input: unknown): string {
  if (input == null) return ''
  return String(input).replace(NBSP, ' ').trim()
}

export function normalizeSearchString(input: unknown): string {
  return cleanString(input)
    .toLowerCase()
    .replace(CYRILLIC_X, 'x')
    .replace(MULTIPLIERS, 'x')
    .replace(PUNCTUATION, ' ')
    .replace(SPACES, ' ')
    .trim()
}

export function tokenize(input: unknown): string[] {
  const normalized = normalizeSearchString(input)
  if (!normalized) return []
  return normalized.split(' ').filter(Boolean)
}

export function uniqueTokens(input: unknown): string[] {
  return Array.from(new Set(tokenize(input)))
}

export function buildNormalizedKey(row: ProductCostStageRow): string {
  return [
    normalizeSearchString(row.excelModelName),
    normalizeSearchString(row.excelProductName),
    normalizeSearchString(row.excelVariantName),
  ]
    .filter(Boolean)
    .join(' | ')
}

export function parseOptionalNumber(input: unknown): number | null {
  if (input == null || input === '') return null
  let normalized = cleanString(input).replace(/[^\d,.-]/g, '')
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized =
      normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
        ? normalized.replace(/\./g, '').replace(',', '.')
        : normalized.replace(/,/g, '')
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.')
  }
  if (!normalized) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

export function parseRequiredNumber(input: unknown, fallback = 0): number {
  return parseOptionalNumber(input) ?? fallback
}

export function parseMonthLabel(input: string): { year: number; month: number } | null {
  const normalized = normalizeSearchString(input)
  const match = normalized.match(/(20\d{2})\s+([а-яіїєґ]+)/i)
  if (!match) return null

  const year = Number(match[1])
  const month = MONTHS_UA[match[2]]

  if (!Number.isFinite(year) || !month) return null

  return { year, month }
}

export function parseMonthFromAdTitle(
  title: string,
  knownMonthYears: Map<string, number>,
): Date | null {
  const normalized = normalizeSearchString(title)
  const monthName = Object.keys(MONTHS_UA).find((month) =>
    normalized.includes(month),
  )

  if (!monthName) return null

  const explicit = normalized.match(/(20\d{2})/)
  const year = explicit ? Number(explicit[1]) : knownMonthYears.get(monthName)
  const month = MONTHS_UA[monthName]

  if (!year || !month) return null

  return new Date(Date.UTC(year, month - 1, 1))
}

export function buildCostImportMarker(sourceRow: number): string {
  return `[excel-import:costs:row=${sourceRow}]`
}

export function buildAdsImportMarker(sourceRow: number): string {
  return `[excel-import:ads:row=${sourceRow}]`
}

export function buildPurchaseImportMarker(blockId: string): string {
  return `[excel-import:purchases:block=${blockId}]`
}
