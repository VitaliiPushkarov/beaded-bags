import type { Expense, Order, OrderItem } from '@prisma/client'

import { buildOrderFinancialSnapshot } from '@/lib/finance'

export function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function endOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

export function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function getDateRangeFromSearchParams(searchParams?: {
  from?: string
  to?: string
}) {
  const now = new Date()
  const fallbackFrom = startOfMonth(now)
  const fallbackTo = endOfDay(now)

  const from = searchParams?.from ? startOfDay(new Date(searchParams.from)) : fallbackFrom
  const to = searchParams?.to ? endOfDay(new Date(searchParams.to)) : fallbackTo

  return {
    from: Number.isNaN(from.getTime()) ? fallbackFrom : from,
    to: Number.isNaN(to.getTime()) ? fallbackTo : to,
  }
}

export function toDateInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)
}

export function formatUAH(amount: number): string {
  return `${Math.round(amount || 0).toLocaleString('uk-UA')} ₴`
}

export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('uk-UA')
}

export type FinanceOrder = Order & { items: OrderItem[] }
export type FinanceProductSnapshot = {
  id: string
  name: string
  slug: string
  unitCostUAH: number
}

type FinanceResolvedProduct = {
  id: string
  unitCostUAH: number
  normalizedName: string
  normalizedSlug: string
}

export type FinanceProductResolver = {
  byId: Map<string, number>
  byExactKey: Map<string, FinanceResolvedProduct>
  products: FinanceResolvedProduct[]
}

function normalizeFinanceProductKey(input: string): string {
  return input
    .toLowerCase()
    .replace(/[—–-]/g, ' ')
    .replace(/[^a-zа-яіїєґ0-9\s]/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getFinanceNameCandidates(input: string): string[] {
  const trimmed = input.trim()
  const beforeDash = trimmed.split(/\s+[—–-]\s+/u)[0]?.trim() ?? trimmed
  const normalized = normalizeFinanceProductKey(trimmed)
  const normalizedBeforeDash = normalizeFinanceProductKey(beforeDash)

  return Array.from(
    new Set([normalized, normalizedBeforeDash].filter(Boolean)),
  )
}

function getFinanceVariantDetails(item: Pick<OrderItem, 'color' | 'modelSize' | 'pouchColor' | 'strapName'>): string[] {
  const details: string[] = []

  if (item.color?.trim()) details.push(`Колір: ${item.color.trim()}`)
  if (item.modelSize?.trim()) details.push(`Розмір: ${item.modelSize.trim()}`)
  if (item.pouchColor?.trim()) details.push(`Мішечок: ${item.pouchColor.trim()}`)
  if (item.strapName?.trim()) details.push(`Ремінець: ${item.strapName.trim()}`)

  return details
}

function buildFinanceLineKey(
  item: Pick<
    OrderItem,
    'productId' | 'variantId' | 'name' | 'color' | 'modelSize' | 'pouchColor' | 'strapName'
  >,
): string {
  return [
    item.productId ?? '',
    item.variantId ?? '',
    normalizeFinanceProductKey(item.name),
    item.color?.trim().toLowerCase() ?? '',
    item.modelSize?.trim().toLowerCase() ?? '',
    item.pouchColor?.trim().toLowerCase() ?? '',
    item.strapName?.trim().toLowerCase() ?? '',
  ].join('::')
}

function resolveProductUnitCost(
  item: Pick<OrderItem, 'productId' | 'name'>,
  resolver?: FinanceProductResolver,
): number {
  if (!resolver) return 0

  if (item.productId) {
    return resolver.byId.get(item.productId) ?? 0
  }

  const candidates = getFinanceNameCandidates(item.name)
  for (const candidate of candidates) {
    const exact = resolver.byExactKey.get(candidate)
    if (exact) return exact.unitCostUAH
  }

  const scoredMatches = resolver.products
    .map((product) => {
      let score = 0

      for (const candidate of candidates) {
        if (!candidate) continue
        if (candidate === product.normalizedName || candidate === product.normalizedSlug) {
          score = Math.max(score, 100)
          continue
        }

        if (
          product.normalizedName.length >= 4 &&
          candidate.includes(product.normalizedName)
        ) {
          score = Math.max(score, 90)
        }

        if (
          product.normalizedSlug.length >= 4 &&
          candidate.includes(product.normalizedSlug)
        ) {
          score = Math.max(score, 85)
        }
      }

      return {
        product,
        score,
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)

  const best = scoredMatches[0]
  const second = scoredMatches[1]

  if (!best) return 0
  if (best.score < 85) return 0
  if (second && best.score === second.score) return 0

  return best.product.unitCostUAH
}

export function buildFinanceProductResolver(
  products: FinanceProductSnapshot[],
): FinanceProductResolver {
  const resolvedProducts = products.map((product) => ({
    id: product.id,
    unitCostUAH: product.unitCostUAH,
    normalizedName: normalizeFinanceProductKey(product.name),
    normalizedSlug: normalizeFinanceProductKey(product.slug),
  }))

  const byExactKey = new Map<string, FinanceResolvedProduct>()
  for (const product of resolvedProducts) {
    if (product.normalizedName) {
      byExactKey.set(product.normalizedName, product)
    }
    if (product.normalizedSlug) {
      byExactKey.set(product.normalizedSlug, product)
    }
  }

  return {
    byId: new Map(products.map((product) => [product.id, product.unitCostUAH])),
    byExactKey,
    products: resolvedProducts,
  }
}

export function resolveOrderFinance(
  order: FinanceOrder,
  productResolver?: FinanceProductResolver,
) {
  const fallbackSnapshot = buildOrderFinancialSnapshot({
    subtotalUAH: order.subtotalUAH,
    discountUAH: order.discountUAH,
    totalUAH: order.totalUAH,
    paymentMethod: order.paymentMethod,
    lines: order.items.map((item) => ({
      qty: item.qty,
      priceUAH: item.priceUAH,
      unitCostUAH: item.unitCostUAH > 0
        ? item.unitCostUAH
        : resolveProductUnitCost(item, productResolver),
    })),
  })

  const lines = order.items.map((item, index) => {
    const fallbackLine = fallbackSnapshot.lines[index]

    const lineRevenueUAH =
      item.lineRevenueUAH > 0 || fallbackLine.lineRevenueUAH === 0
        ? item.lineRevenueUAH
        : fallbackLine.lineRevenueUAH
    const unitCostUAH =
      item.unitCostUAH > 0 || fallbackLine.unitCostUAH === 0
        ? item.unitCostUAH
        : fallbackLine.unitCostUAH
    const totalCostUAH =
      item.totalCostUAH > 0 || fallbackLine.totalCostUAH === 0
        ? item.totalCostUAH
        : fallbackLine.totalCostUAH

    const variantDetails = getFinanceVariantDetails(item)
    const displayName =
      variantDetails.length > 0
        ? `${item.name} — ${variantDetails.join(' · ')}`
        : item.name

    return {
      key: buildFinanceLineKey(item),
      name: displayName,
      qty: item.qty,
      lineRevenueUAH,
      unitCostUAH,
      totalCostUAH,
      grossProfitUAH: lineRevenueUAH - totalCostUAH,
    }
  })

  const itemsCostUAH =
    order.itemsCostUAH > 0 || fallbackSnapshot.itemsCostUAH === 0
      ? order.itemsCostUAH
      : fallbackSnapshot.itemsCostUAH
  const paymentFeeUAH =
    order.paymentFeeUAH > 0 || fallbackSnapshot.paymentFeeUAH === 0
      ? order.paymentFeeUAH
      : fallbackSnapshot.paymentFeeUAH
  const grossProfitUAH = order.totalUAH - itemsCostUAH - paymentFeeUAH

  return {
    revenueUAH: order.totalUAH,
    itemsCostUAH,
    paymentFeeUAH,
    grossProfitUAH,
    lines,
  }
}

export function buildFinanceSummary(input: {
  orders: FinanceOrder[]
  expenses: Expense[]
  materialsCatalogTotalUAH?: number
  productResolver?: FinanceProductResolver
}) {
  const activeOrders = input.orders.filter(
    (order) => order.status !== 'FAILED' && order.status !== 'CANCELLED',
  )
  const recognizedOrders = input.orders.filter(
    (order) => order.status === 'PAID' || order.status === 'FULFILLED',
  )
  const recognizedFinancials = recognizedOrders.map((order) =>
    resolveOrderFinance(order, input.productResolver),
  )

  const placedRevenueUAH = activeOrders.reduce(
    (sum, order) => sum + order.totalUAH,
    0,
  )
  const recognizedRevenueUAH = recognizedOrders.reduce(
    (sum, order) => sum + order.totalUAH,
    0,
  )
  const itemsCostUAH = recognizedFinancials.reduce(
    (sum, order) => sum + order.itemsCostUAH,
    0,
  )
  const paymentFeeUAH = recognizedFinancials.reduce(
    (sum, order) => sum + order.paymentFeeUAH,
    0,
  )
  const grossProfitUAH = recognizedFinancials.reduce(
    (sum, order) => sum + order.grossProfitUAH,
    0,
  )
  const operatingExpensesUAH = input.expenses
    .filter((expense) => expense.category === 'ADS' || expense.category === 'SHIPPING')
    .reduce((sum, expense) => sum + expense.amountUAH, 0)
  const otherExpensesUAH = input.expenses
    .filter((expense) => expense.category !== 'ADS' && expense.category !== 'SHIPPING')
    .reduce((sum, expense) => sum + expense.amountUAH, 0)
  const materialsCatalogTotalUAH = Math.max(
    0,
    Math.round(input.materialsCatalogTotalUAH ?? 0),
  )
  const avgOrderValueUAH =
    activeOrders.length > 0 ? Math.round(placedRevenueUAH / activeOrders.length) : 0

  return {
    activeOrdersCount: activeOrders.length,
    recognizedOrdersCount: recognizedOrders.length,
    placedRevenueUAH,
    recognizedRevenueUAH,
    itemsCostUAH,
    paymentFeeUAH,
    grossProfitUAH,
    operatingExpensesUAH,
    otherExpensesUAH,
    materialsCatalogTotalUAH,
    netAfterExpensesUAH: grossProfitUAH - operatingExpensesUAH,
    avgOrderValueUAH,
  }
}
