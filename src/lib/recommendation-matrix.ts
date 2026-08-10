import type { ProductType } from '@prisma/client'

// Which categories the "You may also like" block may pull from, per category of
// the product being viewed. Before this existed the rule was hardcoded in the
// products API as "same type OR same group"; the matrix makes it editable in
// /admin/configuration without touching any individual product.
//
// Deliberately free of Prisma and next/cache imports so the rules can be unit
// tested; the DB-backed reader lives in lib/recommendation-settings.

// The storefront shows five categories, but ProductType has seven values:
// BACKPACK is merchandised as BAG and ORNAMENTS as ACCESSORY (see
// CATEGORY_BY_TYPE in lib/revalidate-products and TYPE_LABELS in lib/labels).
// The matrix is keyed by the five visible categories so the admin table has one
// row per thing the owner actually sees in the shop.
export const RECOMMENDATION_CATEGORIES = [
  'BAG',
  'BELT_BAG',
  'SHOPPER',
  'CASE',
  'ACCESSORY',
] as const

export type RecommendationCategory = (typeof RECOMMENDATION_CATEGORIES)[number]

export type RecommendationMatrix = Record<
  RecommendationCategory,
  RecommendationCategory[]
>

const CATEGORY_ALIASES: Record<ProductType, RecommendationCategory> = {
  BAG: 'BAG',
  BACKPACK: 'BAG',
  BELT_BAG: 'BELT_BAG',
  SHOPPER: 'SHOPPER',
  CASE: 'CASE',
  ACCESSORY: 'ACCESSORY',
  ORNAMENTS: 'ACCESSORY',
}

// Every ProductType a visible category covers. Used to translate the matrix
// back into a Prisma `type in [...]` filter.
const TYPES_BY_CATEGORY: Record<RecommendationCategory, ProductType[]> = {
  BAG: ['BAG', 'BACKPACK'],
  BELT_BAG: ['BELT_BAG'],
  SHOPPER: ['SHOPPER'],
  CASE: ['CASE'],
  ACCESSORY: ['ACCESSORY', 'ORNAMENTS'],
}

// Conservative starting point: recommend within the same category. Note this is
// narrower than the rule it replaces, which matched "same type OR same group"
// and therefore also pulled in other categories that shared BEADS or WEAVING.
// Cross-category mixing is now opt-in per row rather than a side effect of how a
// product happens to be grouped.
export const RECOMMENDATION_MATRIX_DEFAULTS: RecommendationMatrix = {
  BAG: ['BAG'],
  BELT_BAG: ['BELT_BAG'],
  SHOPPER: ['SHOPPER'],
  CASE: ['CASE'],
  ACCESSORY: ['ACCESSORY'],
}

// Form field name for one checkbox of the admin grid. Shared so the editor and
// the server action that parses its submission cannot drift apart.
export function recommendationCellName(
  row: RecommendationCategory,
  column: RecommendationCategory,
) {
  return `cell_${row}_${column}`
}

export function toRecommendationCategory(
  input?: ProductType | string | null,
): RecommendationCategory | null {
  if (!input) return null
  const key = String(input).trim().toUpperCase()
  return CATEGORY_ALIASES[key as ProductType] ?? null
}

function normalizeCategoryList(input: unknown): RecommendationCategory[] {
  if (!Array.isArray(input)) return []

  const seen = new Set<RecommendationCategory>()
  for (const item of input) {
    const category = toRecommendationCategory(
      typeof item === 'string' ? item : null,
    )
    if (category) seen.add(category)
  }

  // Keep the declared category order so the block is stable regardless of the
  // order checkboxes happened to be submitted in.
  return RECOMMENDATION_CATEGORIES.filter((category) => seen.has(category))
}

/**
 * Coerces whatever is in the JSON column into a full matrix. Unknown keys are
 * dropped and missing rows fall back to the defaults, so an old or partial
 * payload can never leave a category without a rule.
 */
export function normalizeRecommendationMatrix(
  input: unknown,
): RecommendationMatrix {
  const source =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null

  const matrix = {} as RecommendationMatrix

  for (const category of RECOMMENDATION_CATEGORIES) {
    if (!source || !(category in source)) {
      matrix[category] = [...RECOMMENDATION_MATRIX_DEFAULTS[category]]
      continue
    }

    // A row that is present but empty is a deliberate "hide the block here",
    // so it must survive normalization rather than fall back to the default.
    matrix[category] = normalizeCategoryList(source[category])
  }

  return matrix
}

/**
 * The ProductType values the block may show for a product of `type`, ready to
 * drop into a Prisma `in` filter. Empty means the block is switched off for
 * that category.
 */
export function resolveRecommendedTypes(
  matrix: RecommendationMatrix,
  type?: ProductType | string | null,
): ProductType[] {
  const category = toRecommendationCategory(type)
  if (!category) return []

  const allowed = matrix[category] ?? []
  return allowed.flatMap((item) => TYPES_BY_CATEGORY[item])
}
