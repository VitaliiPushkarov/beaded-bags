import { ProductType } from '@prisma/client'

export const TYPE_LABELS: Record<ProductType, string> = {
  BAG: 'Сумки',
  BELT_BAG: 'Бананки',
  BACKPACK: 'Рюкзачки',
  SHOPPER: 'Шопери',
  CASE: 'Чохли',
}

const UI2DB_RAW: Record<string, ProductType> = {
  // укр
  сумки: 'BAG',
  бананки: 'BELT_BAG',
  рюкзачки: 'BACKPACK',
  шопери: 'SHOPPER',
  чохли: 'CASE',
  // англ/ключі
  bag: 'BAG',
  belt_bag: 'BELT_BAG',
  banana: 'BELT_BAG',
  backpack: 'BACKPACK',
  shopper: 'SHOPPER',
  tote: 'SHOPPER',
  case: 'CASE',
  // уже enum
  BAG: 'BAG',
  BELT_BAG: 'BELT_BAG',
  BACKPACK: 'BACKPACK',
  SHOPPER: 'SHOPPER',
  CASE: 'CASE',
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

export function toDbTypePrisma(input?: string | null): ProductType | undefined {
  if (!input) return undefined
  const key = input.trim()
  return UI2DB_RAW[key] || UI2DB_RAW[key.toLowerCase()]
}
