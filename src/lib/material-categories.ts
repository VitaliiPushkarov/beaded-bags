import type { MaterialCategory } from '@prisma/client'

type MaterialCategoryMeta = {
  label: string
  slug: string
  defaultUnit: string
}

export const MATERIAL_CATEGORY_META: Record<MaterialCategory, MaterialCategoryMeta> = {
  BEADS: {
    label: 'Бісер',
    slug: 'beads',
    defaultUnit: 'грам',
  },
  THREADS: {
    label: 'Нитки',
    slug: 'threads',
    defaultUnit: 'шт',
  },
  STRAPS: {
    label: 'Ременці',
    slug: 'straps',
    defaultUnit: 'шт',
  },
  FABRIC: {
    label: 'Тканина',
    slug: 'fabric',
    defaultUnit: 'м',
  },
  HARDWARE: {
    label: 'Фурнітура',
    slug: 'hardware',
    defaultUnit: 'шт',
  },
  CORDS: {
    label: 'Шнури',
    slug: 'cords',
    defaultUnit: 'метри',
  },
}

export const MATERIAL_CATEGORIES = Object.keys(
  MATERIAL_CATEGORY_META,
) as MaterialCategory[]

export function getMaterialCategoryLabel(category: MaterialCategory): string {
  return MATERIAL_CATEGORY_META[category].label
}

export function getMaterialCategoryDefaultUnit(category: MaterialCategory): string {
  return MATERIAL_CATEGORY_META[category].defaultUnit
}

export function materialCategoryToSlug(category: MaterialCategory): string {
  return MATERIAL_CATEGORY_META[category].slug
}

export function materialCategoryFromSlug(
  slug: string,
): MaterialCategory | null {
  const normalized = slug.trim().toLowerCase()

  const found = MATERIAL_CATEGORIES.find(
    (category) => MATERIAL_CATEGORY_META[category].slug === normalized,
  )

  return found ?? null
}
