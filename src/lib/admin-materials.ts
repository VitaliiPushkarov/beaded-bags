import type { MaterialCategory } from '@prisma/client'

export type MaterialLocationHint = {
  id: string
  name: string
  color: string
  category: MaterialCategory
  href: string
}

export type MaterialsBulkCreateActionResult = {
  createdCount: number
  existingCount: number
  created: MaterialLocationHint[]
  existing: MaterialLocationHint[]
}

export type MaterialNameSuggestion = {
  name: string
  category: MaterialCategory
  variantsCount: number
  colors: string[]
}
