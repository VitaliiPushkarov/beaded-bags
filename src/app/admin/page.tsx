import Link from 'next/link'
import { OrderStatus, ProductType } from '@prisma/client'

import {
  endOfDay,
  formatDate,
  formatUAH,
  startOfDay,
  startOfMonth,
  toDateInputValue,
} from '@/lib/admin-finance'
import { TYPE_LABELS } from '@/lib/labels'
import { prisma } from '@/lib/prisma'
import {
  ACCESSORY_SUBCATEGORIES,
  matchAccessorySubcategory,
} from '@/lib/shop-taxonomy'
import OverviewDateRangePicker from '@/components/admin/OverviewDateRangePicker'
import OverviewCharts from '@/components/admin/OverviewCharts'

export const dynamic = 'force-dynamic'

type RangePreset = '7d' | '30d' | '90d' | 'mtd' | 'ytd' | 'custom'
type ComparePreset = 'none' | 'prev' | 'yoy' | 'custom'

type PageProps = {
  searchParams: Promise<{
    preset?: string
    from?: string
    to?: string
    comparePreset?: string
    compareFrom?: string
    compareTo?: string
  }>
}

type PerformanceSummary = {
  totalSalesUAH: number
  netSalesUAH: number
  ordersCount: number
  productsSoldQty: number
}

type DateRange = {
  from: Date
  to: Date
}

type DayBucket = {
  key: string
  label: string
}

const RECOGNIZED_ORDER_STATUSES: OrderStatus[] = ['PAID', 'FULFILLED']

function getValidPreset(raw?: string): RangePreset {
  if (
    raw === '7d' ||
    raw === '30d' ||
    raw === '90d' ||
    raw === 'mtd' ||
    raw === 'ytd' ||
    raw === 'custom'
  ) {
    return raw
  }

  return '30d'
}

function getValidComparePreset(raw?: string): ComparePreset {
  if (raw === 'none' || raw === 'prev' || raw === 'yoy' || raw === 'custom') {
    return raw
  }

  return 'none'
}

function parseDateInput(raw?: string): Date | null {
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function resolveRange(
  preset: RangePreset,
  fromRaw: string | undefined,
  toRaw: string | undefined,
): DateRange {
  const now = new Date()

  if (preset === 'custom') {
    const parsedFrom = parseDateInput(fromRaw)
    const parsedTo = parseDateInput(toRaw)

    if (parsedFrom && parsedTo) {
      const from = startOfDay(parsedFrom)
      const to = endOfDay(parsedTo)

      if (from.getTime() <= to.getTime()) {
        return { from, to }
      }
    }
  }

  if (preset === '7d') {
    const from = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000))
    return { from, to: endOfDay(now) }
  }

  if (preset === '90d') {
    const from = startOfDay(new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000))
    return { from, to: endOfDay(now) }
  }

  if (preset === 'mtd') {
    return { from: startOfMonth(now), to: endOfDay(now) }
  }

  if (preset === 'ytd') {
    return {
      from: startOfDay(new Date(now.getFullYear(), 0, 1)),
      to: endOfDay(now),
    }
  }

  const from = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000))
  return { from, to: endOfDay(now) }
}

function getPreviousRange(currentFrom: Date, currentTo: Date): DateRange {
  const durationMs = currentTo.getTime() - currentFrom.getTime() + 1
  const prevTo = new Date(currentFrom.getTime() - 1)
  const prevFrom = new Date(prevTo.getTime() - durationMs + 1)

  return {
    from: prevFrom,
    to: prevTo,
  }
}

function getYearOverYearRange(currentRange: DateRange): DateRange {
  const from = new Date(currentRange.from)
  const to = new Date(currentRange.to)

  from.setFullYear(from.getFullYear() - 1)
  to.setFullYear(to.getFullYear() - 1)

  return {
    from: startOfDay(from),
    to: endOfDay(to),
  }
}

function resolveCompareRange(input: {
  comparePreset: ComparePreset
  currentRange: DateRange
  compareFromRaw?: string
  compareToRaw?: string
}): DateRange | null {
  if (input.comparePreset === 'none') {
    return null
  }

  if (input.comparePreset === 'prev') {
    return getPreviousRange(input.currentRange.from, input.currentRange.to)
  }

  if (input.comparePreset === 'yoy') {
    return getYearOverYearRange(input.currentRange)
  }

  const parsedFrom = parseDateInput(input.compareFromRaw)
  const parsedTo = parseDateInput(input.compareToRaw)
  if (!parsedFrom || !parsedTo) return null

  const from = startOfDay(parsedFrom)
  const to = endOfDay(parsedTo)
  if (from.getTime() > to.getTime()) return null

  return { from, to }
}

function getComparePresetLabel(comparePreset: ComparePreset): string {
  if (comparePreset === 'prev') return 'Попередній період'
  if (comparePreset === 'yoy') return 'Аналогічний період минулого року'
  if (comparePreset === 'custom') return 'Кастомний період'
  return 'Без порівняння'
}

function createDayBuckets(range: DateRange): DayBucket[] {
  const dayBuckets: DayBucket[] = []
  for (
    let cursor = startOfDay(range.from);
    cursor.getTime() <= range.to.getTime();
    cursor = startOfDay(new Date(cursor.getTime() + 24 * 60 * 60 * 1000))
  ) {
    dayBuckets.push({
      key: toDateInputValue(cursor),
      label: new Intl.DateTimeFormat('uk-UA', {
        day: '2-digit',
        month: '2-digit',
      }).format(cursor),
    })
  }

  return dayBuckets
}

function aggregateDailySeries(
  orders: Array<{
    createdAt: Date
    totalUAH: number
  }>,
  dayBuckets: DayBucket[],
) {
  const seriesMap = new Map<
    string,
    {
      netSalesUAH: number
      ordersCount: number
    }
  >()

  for (const bucket of dayBuckets) {
    seriesMap.set(bucket.key, {
      netSalesUAH: 0,
      ordersCount: 0,
    })
  }

  for (const order of orders) {
    const key = toDateInputValue(order.createdAt)
    const current = seriesMap.get(key)
    if (!current) continue

    current.netSalesUAH += Math.max(0, order.totalUAH)
    current.ordersCount += 1
  }

  return seriesMap
}

function aggregatePerformance(
  orders: Array<{
    subtotalUAH: number
    deliveryUAH: number
    totalUAH: number
    items: Array<{ qty: number }>
  }>,
): PerformanceSummary {
  return orders.reduce<PerformanceSummary>(
    (acc, order) => {
      acc.totalSalesUAH += Math.max(0, order.subtotalUAH + order.deliveryUAH)
      acc.netSalesUAH += Math.max(0, order.totalUAH)
      acc.ordersCount += 1
      acc.productsSoldQty += order.items.reduce(
        (sum, item) => sum + Math.max(0, item.qty),
        0,
      )
      return acc
    },
    {
      totalSalesUAH: 0,
      netSalesUAH: 0,
      ordersCount: 0,
      productsSoldQty: 0,
    },
  )
}

function calcChangePercent(current: number, previous: number): number {
  if (previous === 0 && current === 0) return 0
  if (previous === 0) return 100
  return Math.round(((current - previous) / previous) * 100)
}

function getChangeBadgeClass(changePercent: number): string {
  if (changePercent > 0) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (changePercent < 0) return 'bg-rose-50 text-rose-700 border-rose-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function formatChange(changePercent: number): string {
  return `${changePercent > 0 ? '+' : ''}${changePercent}%`
}

function getCategoryLabel(input: {
  product:
    | {
        type: ProductType
        name: string
        slug: string
      }
    | undefined
  itemName: string
}): string {
  if (input.product) {
    const product = input.product
    const normalizedType =
      product.type === 'ORNAMENTS' ? 'ACCESSORY' : product.type

    if (normalizedType === 'ACCESSORY') {
      const matchedSubcategory = ACCESSORY_SUBCATEGORIES.find((subcategory) =>
        matchAccessorySubcategory(product, subcategory.slug),
      )

      return matchedSubcategory
        ? `Аксесуари: ${matchedSubcategory.label}`
        : 'Аксесуари: Інше'
    }

    return TYPE_LABELS[normalizedType]
  }

  const pseudoProduct = {
    name: input.itemName,
    slug: input.itemName,
  }
  const matchedSubcategory = ACCESSORY_SUBCATEGORIES.find((subcategory) =>
    matchAccessorySubcategory(pseudoProduct, subcategory.slug),
  )

  return matchedSubcategory
    ? `Аксесуари: ${matchedSubcategory.label}`
    : 'Без категорії'
}

export default async function AdminDashboard({ searchParams }: PageProps) {
  const params = await searchParams
  const preset = getValidPreset(params.preset)
  const comparePreset = getValidComparePreset(params.comparePreset)
  const currentRange = resolveRange(preset, params.from, params.to)
  const previousRange = getPreviousRange(currentRange.from, currentRange.to)
  const compareRange = resolveCompareRange({
    comparePreset,
    currentRange,
    compareFromRaw: params.compareFrom,
    compareToRaw: params.compareTo,
  })

  const queryFrom = new Date(
    Math.min(
      previousRange.from.getTime(),
      currentRange.from.getTime(),
      compareRange?.from.getTime() ?? Number.POSITIVE_INFINITY,
    ),
  )
  const queryTo = new Date(
    Math.max(
      previousRange.to.getTime(),
      currentRange.to.getTime(),
      compareRange?.to.getTime() ?? Number.NEGATIVE_INFINITY,
    ),
  )

  const orders = await prisma.order.findMany({
    where: {
      status: {
        in: RECOGNIZED_ORDER_STATUSES,
      },
      createdAt: {
        gte: queryFrom,
        lte: queryTo,
      },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      createdAt: true,
      subtotalUAH: true,
      deliveryUAH: true,
      totalUAH: true,
      items: {
        select: {
          productId: true,
          name: true,
          qty: true,
          priceUAH: true,
        },
      },
    },
  })

  const fromMs = currentRange.from.getTime()
  const toMs = currentRange.to.getTime()
  const prevFromMs = previousRange.from.getTime()
  const prevToMs = previousRange.to.getTime()
  const compareFromMs = compareRange?.from.getTime() ?? null
  const compareToMs = compareRange?.to.getTime() ?? null

  const currentOrders = orders.filter((order) => {
    const ts = order.createdAt.getTime()
    return ts >= fromMs && ts <= toMs
  })

  const previousOrders = orders.filter((order) => {
    const ts = order.createdAt.getTime()
    return ts >= prevFromMs && ts <= prevToMs
  })
  const compareOrders = orders.filter((order) => {
    if (compareFromMs == null || compareToMs == null) return false
    const ts = order.createdAt.getTime()
    return ts >= compareFromMs && ts <= compareToMs
  })

  const currentPerformance = aggregatePerformance(currentOrders)
  const previousPerformance = aggregatePerformance(previousOrders)

  const fromInput = toDateInputValue(currentRange.from)
  const toInput = toDateInputValue(currentRange.to)
  const compareFromInput = compareRange ? toDateInputValue(compareRange.from) : ''
  const compareToInput = compareRange ? toDateInputValue(compareRange.to) : ''
  const rangeQuery = new URLSearchParams({
    from: fromInput,
    to: toInput,
  }).toString()

  const dayBuckets = createDayBuckets(currentRange)
  const seriesMap = aggregateDailySeries(currentOrders, dayBuckets)

  const compareDayBuckets = compareRange ? createDayBuckets(compareRange) : []
  const compareSeriesMap = aggregateDailySeries(compareOrders, compareDayBuckets)

  const chartPoints = dayBuckets.map((bucket, index) => {
    const compareBucket = compareDayBuckets[index]
    const compareValues = compareBucket
      ? compareSeriesMap.get(compareBucket.key)
      : undefined

    return {
      key: bucket.key,
      label: bucket.label,
      netSalesUAH: seriesMap.get(bucket.key)?.netSalesUAH ?? 0,
      ordersCount: seriesMap.get(bucket.key)?.ordersCount ?? 0,
      compareNetSalesUAH: compareValues?.netSalesUAH,
      compareOrdersCount: compareValues?.ordersCount,
      compareLabel: compareBucket?.label,
    }
  })

  const chartComparison =
    compareRange && chartPoints.some((point) => point.compareLabel)
      ? {
          label: getComparePresetLabel(comparePreset),
          periodLabel: `${formatDate(compareRange.from)} - ${formatDate(compareRange.to)}`,
        }
      : null

  const soldProductIds = Array.from(
    new Set(
      currentOrders.flatMap((order) =>
        order.items
          .map((item) => item.productId)
          .filter((id): id is string => Boolean(id)),
      ),
    ),
  )

  const soldProducts = soldProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: soldProductIds } },
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
        },
      })
    : []

  const soldProductById = new Map(soldProducts.map((product) => [product.id, product]))

  const categoryStats = new Map<string, { label: string; qty: number }>()
  const productStats = new Map<
    string,
    {
      label: string
      qty: number
      href: string
    }
  >()

  for (const order of currentOrders) {
    for (const item of order.items) {
      const qty = Math.max(0, item.qty)
      if (!qty) continue

      const product = item.productId ? soldProductById.get(item.productId) : undefined

      const categoryLabel = getCategoryLabel({
        product,
        itemName: item.name,
      })

      const categoryKey = categoryLabel
      const categoryEntry = categoryStats.get(categoryKey)

      if (categoryEntry) {
        categoryEntry.qty += qty
      } else {
        categoryStats.set(categoryKey, {
          label: categoryLabel,
          qty,
        })
      }

      const productKey = product?.id ?? `name:${item.name}`
      const productEntry = productStats.get(productKey)

      if (productEntry) {
        productEntry.qty += qty
      } else {
        productStats.set(productKey, {
          label: product?.name ?? item.name,
          qty,
          href: product
            ? `/admin/products?q=${encodeURIComponent(product.slug)}`
            : '/admin/orders',
        })
      }
    }
  }

  const topCategories = Array.from(categoryStats.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8)

  const topProducts = Array.from(productStats.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8)

  const performanceCards = [
    {
      title: 'Всього продажів',
      value: formatUAH(currentPerformance.totalSalesUAH),
      change: calcChangePercent(
        currentPerformance.totalSalesUAH,
        previousPerformance.totalSalesUAH,
      ),
      href: `/admin/finance?${rangeQuery}`,
    },
    {
      title: 'Чистий обсяг продажів',
      value: formatUAH(currentPerformance.netSalesUAH),
      change: calcChangePercent(
        currentPerformance.netSalesUAH,
        previousPerformance.netSalesUAH,
      ),
      href: `/admin/finance?${rangeQuery}`,
    },
    {
      title: 'Замовлення к-сть',
      value: currentPerformance.ordersCount.toLocaleString('uk-UA'),
      change: calcChangePercent(
        currentPerformance.ordersCount,
        previousPerformance.ordersCount,
      ),
      href: '/admin/orders',
    },
    {
      title: 'Товарів продано',
      value: currentPerformance.productsSoldQty.toLocaleString('uk-UA'),
      change: calcChangePercent(
        currentPerformance.productsSoldQty,
        previousPerformance.productsSoldQty,
      ),
      href: `/admin/finance?${rangeQuery}`,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Огляд</h1>
        <p className="mt-1 text-sm text-gray-600">
          Аналітика продажів за вибраний проміжок часу.
        </p>
      </div>

      <OverviewDateRangePicker
        initialPreset={preset}
        initialFrom={fromInput}
        initialTo={toInput}
        initialComparePreset={comparePreset}
        initialCompareFrom={compareFromInput}
        initialCompareTo={compareToInput}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Продуктивність</h2>
          <p className="mt-1 text-sm text-gray-600">
            Кожен показник відкриває сторінку, де формується його статистика.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {performanceCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="admin-card p-5 transition hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm text-slate-600">{card.title}</div>
                <span
                  className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${getChangeBadgeClass(
                    card.change,
                  )}`}
                >
                  {formatChange(card.change)}
                </span>
              </div>
              <div className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
                {card.value}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <OverviewCharts points={chartPoints} comparison={chartComparison ?? undefined} />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Дошка лідерів</h2>
          <p className="mt-1 text-sm text-gray-600">
            Популярні категорії і товари за кількістю проданих одиниць.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="admin-card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-slate-900">Популярні категорії</div>
              <Link
                href="/admin/products"
                className="text-xs text-blue-600 hover:underline"
              >
                Товари
              </Link>
            </div>
            {topCategories.length === 0 ? (
              <div className="text-sm text-gray-600">Немає даних за обраний період.</div>
            ) : (
              <div className="space-y-2">
                {topCategories.map((category, index) => (
                  <div
                    key={`${category.label}-${index}`}
                    className="flex items-center justify-between rounded border px-3 py-2"
                  >
                    <div className="text-sm text-slate-700">{category.label}</div>
                    <div className="text-sm font-semibold text-slate-900">
                      {category.qty.toLocaleString('uk-UA')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-slate-900">Популярні товари</div>
              <Link
                href={`/admin/finance?${rangeQuery}`}
                className="text-xs text-blue-600 hover:underline"
              >
                Фінанси
              </Link>
            </div>
            {topProducts.length === 0 ? (
              <div className="text-sm text-gray-600">Немає даних за обраний період.</div>
            ) : (
              <div className="space-y-2">
                {topProducts.map((product, index) => (
                  <Link
                    key={`${product.label}-${index}`}
                    href={product.href}
                    className="flex items-center justify-between rounded border px-3 py-2 hover:bg-slate-50"
                  >
                    <div className="text-sm text-slate-700">{product.label}</div>
                    <div className="text-sm font-semibold text-slate-900">
                      {product.qty.toLocaleString('uk-UA')}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
