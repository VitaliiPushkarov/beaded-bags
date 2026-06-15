import type { Locale } from '@/lib/locale'
import type { MoneyCurrency } from '@/lib/localized-product'

type CartPricedItem = {
  priceUAH: number
  priceUSD?: number | null
  qty: number
}

function normalizeMoneyAmount(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.round(value))
}

export function resolveCartDisplayCurrency(input: {
  items: Array<Pick<CartPricedItem, 'priceUSD'>>
  locale?: Locale
  preferredCurrency?: MoneyCurrency
}): MoneyCurrency {
  const preferredCurrency =
    input.preferredCurrency ?? (input.locale === 'en' ? 'USD' : 'UAH')

  if (preferredCurrency === 'USD') {
    const allItemsHaveUsdPrice = input.items.every(
      (item) => normalizeMoneyAmount(item.priceUSD) != null,
    )
    if (allItemsHaveUsdPrice) return 'USD'
  }

  return 'UAH'
}

export function getCartItemUnitPrice(
  item: Pick<CartPricedItem, 'priceUAH' | 'priceUSD'>,
  currency: MoneyCurrency,
): number {
  if (currency === 'USD') {
    return normalizeMoneyAmount(item.priceUSD) ?? 0
  }

  return normalizeMoneyAmount(item.priceUAH) ?? 0
}

export function sumCartDisplayAmount(
  items: CartPricedItem[],
  currency: MoneyCurrency,
): number {
  return items.reduce((sum, item) => {
    return sum + getCartItemUnitPrice(item, currency) * Math.max(0, item.qty)
  }, 0)
}
