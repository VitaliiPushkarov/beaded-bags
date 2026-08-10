import type { ProductType } from '@prisma/client'

import { getAccessorySubcategorySlugs } from '@/lib/shop-taxonomy'

// Which categories the "You may also like" block may pull from, per category of
// the product being viewed. Before this existed the rule was hardcoded in the
// products API as "same type OR same group"; the matrix makes it editable in
// /admin/configuration without touching any individual product.
//
// Rows are always one of the five visible categories. Columns are wider: besides
// those categories they can name a single accessory subcategory (breloky,
// gerdany, …) so a bag page can recommend keychains without pulling in every
// accessory. Subcategories are columns only — an accessory product page still
// gets its rule from the ACCESSORY row.
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

// Subcategory columns are stored prefixed so one flat string[] can hold both
// kinds of target without a second field in the JSON payload.
export const SUBCATEGORY_PREFIX = 'sub:'

export type RecommendationSubcategory = `${typeof SUBCATEGORY_PREFIX}${string}`

export type RecommendationTarget =
  | RecommendationCategory
  | RecommendationSubcategory

export type RecommendationMatrix = Record<
  RecommendationCategory,
  RecommendationTarget[]
>

export function toSubcategoryTarget(slug: string): RecommendationSubcategory {
  return `${SUBCATEGORY_PREFIX}${slug}`
}

export function isSubcategoryTarget(
  target: string,
): target is RecommendationSubcategory {
  return target.startsWith(SUBCATEGORY_PREFIX)
}

export function subcategorySlugOf(target: RecommendationSubcategory): string {
  return target.slice(SUBCATEGORY_PREFIX.length)
}

/**
 * Column order for the admin grid and for normalization: the five categories
 * first, then one column per accessory subcategory. Derived from the shop's own
 * taxonomy so a subcategory added there shows up here automatically.
 */
export function recommendationTargets(): RecommendationTarget[] {
  return [
    ...RECOMMENDATION_CATEGORIES,
    ...getAccessorySubcategorySlugs().map(toSubcategoryTarget),
  ]
}

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
  column: RecommendationTarget,
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

function normalizeTargetList(input: unknown): RecommendationTarget[] {
  if (!Array.isArray(input)) return []

  const knownSubcategories = new Set(getAccessorySubcategorySlugs())
  const seen = new Set<RecommendationTarget>()

  for (const item of input) {
    if (typeof item !== 'string') continue
    const raw = item.trim()

    if (isSubcategoryTarget(raw)) {
      // Drop subcategories the shop no longer declares, so a renamed slug can
      // never silently keep filtering on something that does not exist.
      if (knownSubcategories.has(subcategorySlugOf(raw))) seen.add(raw)
      continue
    }

    const category = toRecommendationCategory(raw)
    if (category) seen.add(category)
  }

  // Keep the declared column order so the block is stable regardless of the
  // order checkboxes happened to be submitted in.
  return recommendationTargets().filter((target) => seen.has(target))
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
    matrix[category] = normalizeTargetList(source[category])
  }

  return matrix
}

/**
 * What the block may show for a product of `type`, split into the two things the
 * query needs: whole categories (a plain `type in [...]` filter) and accessory
 * subcategories (keyword-matched on name/slug, exactly as the shop's own
 * subcategory pages do).
 *
 * Both empty means the block is switched off for that category.
 */
export function resolveRecommendation(
  matrix: RecommendationMatrix,
  type?: ProductType | string | null,
): { types: ProductType[]; subcategories: string[] } {
  const category = toRecommendationCategory(type)
  if (!category) return { types: [], subcategories: [] }

  const allowed = matrix[category] ?? []
  const types: ProductType[] = []
  const subcategories: string[] = []

  for (const target of allowed) {
    if (isSubcategoryTarget(target)) {
      subcategories.push(subcategorySlugOf(target))
      continue
    }
    types.push(...TYPES_BY_CATEGORY[target])
  }

  return { types, subcategories }
}

/**
 * Product types a subcategory column can ever match. Subcategory keywords are
 * broad on purpose ("вязан" catches anything knitted), so the candidate set has
 * to be pinned to accessories or a knitted bag would qualify as a keychain.
 */
export const SUBCATEGORY_CANDIDATE_TYPES: ProductType[] =
  TYPES_BY_CATEGORY.ACCESSORY
