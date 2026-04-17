import { ProductType } from '@prisma/client'
import type { Locale } from './locale'

export const TYPE_LABELS: Record<ProductType, string> = {
  BAG: 'Сумки',
  BELT_BAG: 'Бананки',
  BACKPACK: 'Рюкзачки',
  SHOPPER: 'Шопери',
  CASE: 'Чохли',
  ORNAMENTS: 'Аксесуари',
  ACCESSORY: 'Аксесуари',
}

export const TYPE_LABELS_EN: Record<ProductType, string> = {
  BAG: 'Bags',
  BELT_BAG: 'Belt Bags',
  BACKPACK: 'Backpacks',
  SHOPPER: 'Shoppers',
  CASE: 'Cases',
  ORNAMENTS: 'Accessories',
  ACCESSORY: 'Accessories',
}

export const ACTIVE_PRODUCT_TYPES: ProductType[] = [
  'BAG',
  'BELT_BAG',
  'BACKPACK',
  'SHOPPER',
  'CASE',
  'ACCESSORY',
]

const UI2DB_RAW: Record<string, ProductType> = {
  // укр
  сумки: 'BAG',
  бананки: 'BELT_BAG',
  рюкзачки: 'BACKPACK',
  шопери: 'SHOPPER',
  чохли: 'CASE',
  прикраси: 'ACCESSORY',
  аксесуари: 'ACCESSORY',
  // англ/ключі
  bag: 'BAG',
  belt_bag: 'BELT_BAG',
  banana: 'BELT_BAG',
  backpack: 'BACKPACK',
  shopper: 'SHOPPER',
  tote: 'SHOPPER',
  case: 'CASE',
  ornaments: 'ACCESSORY',
  accessory: 'ACCESSORY',
  // enum
  BAG: 'BAG',
  BELT_BAG: 'BELT_BAG',
  BACKPACK: 'BACKPACK',
  SHOPPER: 'SHOPPER',
  CASE: 'CASE',
  ORNAMENTS: 'ACCESSORY',
  ACCESSORY: 'ACCESSORY',
}

export const COLOR_LABELS: Record<string, string> = {
  Pink: 'Рожева',
  Red: 'Червона',
  Blue: 'Блакитна',
  White: 'Біла',
  Sand: 'Пісочна',
  Olive: 'Оливкова',
  Deep: 'Глибока зелень',
  Violet: 'Фіолетова',
}

export const COLOR_LABELS_EN: Record<string, string> = {
  Pink: 'Pink',
  Red: 'Red',
  Blue: 'Blue',
  White: 'White',
  Sand: 'Sand',
  Olive: 'Olive',
  Deep: 'Deep Green',
  Violet: 'Violet',
}

export function getTypeLabel(
  type: ProductType,
  locale: Locale = 'uk',
): string {
  return locale === 'en' ? TYPE_LABELS_EN[type] : TYPE_LABELS[type]
}

export function getColorLabel(color: string, locale: Locale = 'uk'): string {
  if (locale === 'en') return COLOR_LABELS_EN[color] || color
  return COLOR_LABELS[color] || color
}

export function toDbTypePrisma(input?: string | null): ProductType | undefined {
  if (!input) return undefined
  const key = input.trim()
  return UI2DB_RAW[key] || UI2DB_RAW[key.toLowerCase()]
}
