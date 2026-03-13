'use client'

import { useMemo, useState } from 'react'

type SeriesPoint = {
  key: string
  label: string
  netSalesUAH: number
  ordersCount: number
  compareNetSalesUAH?: number
  compareOrdersCount?: number
  compareLabel?: string
}

type Props = {
  points: SeriesPoint[]
  comparison?: {
    label: string
    periodLabel: string
  }
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat('uk-UA', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatUAH(value: number): string {
  return `${Math.round(value).toLocaleString('uk-UA')} ₴`
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString('uk-UA')
}

const CHART_WIDTH = 760
const CHART_HEIGHT = 260
const PADDING = {
  top: 16,
  right: 18,
  bottom: 40,
  left: 42,
}

function yScale(value: number, maxValue: number): number {
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom
  if (maxValue <= 0) return PADDING.top + innerHeight
  return PADDING.top + innerHeight - (value / maxValue) * innerHeight
}

function xScale(index: number, total: number): number {
  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right
  if (total <= 1) return PADDING.left + innerWidth / 2
  return PADDING.left + (index / (total - 1)) * innerWidth
}

function buildLinePath(values: number[], maxValue: number): string {
  return values
    .map((value, index) => {
      const x = xScale(index, values.length)
      const y = yScale(value, maxValue)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

export default function OverviewCharts({ points, comparison }: Props) {
  const [hoveredNetIndex, setHoveredNetIndex] = useState<number | null>(null)
  const [hoveredOrdersIndex, setHoveredOrdersIndex] = useState<number | null>(null)

  const hasComparison = useMemo(
    () =>
      points.some(
        (point) =>
          typeof point.compareNetSalesUAH === 'number' ||
          typeof point.compareOrdersCount === 'number',
      ),
    [points],
  )

  const lineChart = useMemo(() => {
    const currentValues = points.map((point) => point.netSalesUAH)
    const compareValues = points.map((point) => point.compareNetSalesUAH ?? 0)
    const maxValue = hasComparison
      ? Math.max(1, ...currentValues, ...compareValues)
      : Math.max(1, ...currentValues)

    return {
      maxValue,
      currentPath: buildLinePath(currentValues, maxValue),
      comparePath: hasComparison ? buildLinePath(compareValues, maxValue) : null,
    }
  }, [hasComparison, points])

  const barChart = useMemo(() => {
    const currentValues = points.map((point) => point.ordersCount)
    const compareValues = points.map((point) => point.compareOrdersCount ?? 0)
    const maxValue = hasComparison
      ? Math.max(1, ...currentValues, ...compareValues)
      : Math.max(1, ...currentValues)

    return {
      maxValue,
    }
  }, [hasComparison, points])

  const hoveredNet =
    hoveredNetIndex != null ? points[hoveredNetIndex] : points[points.length - 1]
  const hoveredOrders =
    hoveredOrdersIndex != null
      ? points[hoveredOrdersIndex]
      : points[points.length - 1]

  if (points.length === 0) {
    return (
      <section className="rounded border bg-white p-4 sm:p-6">
        <h2 className="text-lg font-medium">Графіки</h2>
        <p className="mt-2 text-sm text-gray-600">Немає даних за обраний період.</p>
      </section>
    )
  }

  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right
  const barSlot = innerWidth / Math.max(points.length, 1)
  const groupWidth = Math.min(36, barSlot * 0.74)
  const pairGap = hasComparison ? Math.min(4, barSlot * 0.12) : 0
  const barWidth = hasComparison
    ? Math.max(6, (groupWidth - pairGap) / 2)
    : Math.max(8, Math.min(28, barSlot * 0.62))

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Графіки</h2>
        <p className="mt-1 text-sm text-gray-600">
          Інтерактивна динаміка чистого обсягу продажів і кількості замовлень.
        </p>
        {hasComparison && comparison ? (
          <p className="mt-1 text-sm text-gray-600">
            Порівняння: {comparison.label} ({comparison.periodLabel})
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded border bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-gray-500">Чистий обсяг продажів</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {hoveredNet ? formatUAH(hoveredNet.netSalesUAH) : '0 ₴'}
              </div>
              {hasComparison ? (
                <div className="mt-1 text-sm text-slate-600">
                  {comparison?.label ?? 'Порівняння'}:{' '}
                  {formatUAH(hoveredNet?.compareNetSalesUAH ?? 0)}
                </div>
              ) : null}
            </div>
            <div className="rounded border bg-slate-50 px-2 py-1 text-xs text-slate-600">
              {hoveredNet?.label ?? '—'}
              {hasComparison && hoveredNet?.compareLabel ? ` / ${hoveredNet.compareLabel}` : ''}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="h-[220px] w-full min-w-[560px]"
              role="img"
              aria-label="Графік чистого обсягу продажів"
            >
              {[0, 1, 2, 3, 4].map((step) => {
                const value = (lineChart.maxValue / 4) * step
                const y = yScale(value, lineChart.maxValue)
                return (
                  <g key={`grid-net-${step}`}>
                    <line
                      x1={PADDING.left}
                      x2={CHART_WIDTH - PADDING.right}
                      y1={y}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="3 4"
                    />
                    <text
                      x={PADDING.left - 8}
                      y={y + 4}
                      fontSize="11"
                      textAnchor="end"
                      fill="#64748b"
                    >
                      {step === 0 ? '0' : formatCompact(value)}
                    </text>
                  </g>
                )
              })}

              {lineChart.comparePath ? (
                <path
                  d={lineChart.comparePath}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                />
              ) : null}

              <path
                d={lineChart.currentPath}
                fill="none"
                stroke="#0f172a"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {points.map((point, index) => {
                const x = xScale(index, points.length)
                const y = yScale(point.netSalesUAH, lineChart.maxValue)
                const compareY = yScale(point.compareNetSalesUAH ?? 0, lineChart.maxValue)

                return (
                  <g key={`dot-net-${point.key}`}>
                    {hasComparison && point.compareLabel ? (
                      <circle cx={x} cy={compareY} r={2.8} fill="#94a3b8" />
                    ) : null}
                    <circle
                      cx={x}
                      cy={y}
                      r={hoveredNetIndex === index ? 5 : 3.2}
                      fill={hoveredNetIndex === index ? '#f43f5e' : '#0f172a'}
                    />
                    <rect
                      x={x - Math.max(12, barSlot / 2)}
                      y={PADDING.top}
                      width={Math.max(24, barSlot)}
                      height={CHART_HEIGHT - PADDING.top - PADDING.bottom}
                      fill="transparent"
                      onMouseEnter={() => setHoveredNetIndex(index)}
                      onMouseLeave={() => setHoveredNetIndex(null)}
                    />
                    {index % Math.ceil(points.length / 6) === 0 || index === points.length - 1 ? (
                      <text
                        x={x}
                        y={CHART_HEIGHT - 14}
                        fontSize="11"
                        textAnchor="middle"
                        fill="#64748b"
                      >
                        {point.label}
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        <div className="rounded border bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-gray-500">Замовлення</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {hoveredOrders ? formatCount(hoveredOrders.ordersCount) : '0'}
              </div>
              {hasComparison ? (
                <div className="mt-1 text-sm text-slate-600">
                  {comparison?.label ?? 'Порівняння'}:{' '}
                  {formatCount(hoveredOrders?.compareOrdersCount ?? 0)}
                </div>
              ) : null}
            </div>
            <div className="rounded border bg-slate-50 px-2 py-1 text-xs text-slate-600">
              {hoveredOrders?.label ?? '—'}
              {hasComparison && hoveredOrders?.compareLabel
                ? ` / ${hoveredOrders.compareLabel}`
                : ''}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="h-[220px] w-full min-w-[560px]"
              role="img"
              aria-label="Графік кількості замовлень"
            >
              {[0, 1, 2, 3, 4].map((step) => {
                const value = (barChart.maxValue / 4) * step
                const y = yScale(value, barChart.maxValue)
                return (
                  <g key={`grid-orders-${step}`}>
                    <line
                      x1={PADDING.left}
                      x2={CHART_WIDTH - PADDING.right}
                      y1={y}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="3 4"
                    />
                    <text
                      x={PADDING.left - 8}
                      y={y + 4}
                      fontSize="11"
                      textAnchor="end"
                      fill="#64748b"
                    >
                      {Math.round(value)}
                    </text>
                  </g>
                )
              })}

              {points.map((point, index) => {
                const xCenter = xScale(index, points.length)
                const compareValue = point.compareOrdersCount ?? 0
                const compareY = yScale(compareValue, barChart.maxValue)
                const compareH = CHART_HEIGHT - PADDING.bottom - compareY

                const currentY = yScale(point.ordersCount, barChart.maxValue)
                const currentH = CHART_HEIGHT - PADDING.bottom - currentY

                const totalGroupWidth = hasComparison
                  ? barWidth * 2 + pairGap
                  : barWidth
                const groupStartX = xCenter - totalGroupWidth / 2
                const compareX = groupStartX
                const currentX = hasComparison
                  ? groupStartX + barWidth + pairGap
                  : groupStartX

                return (
                  <g key={`bar-orders-${point.key}`}>
                    {hasComparison ? (
                      <rect
                        x={compareX}
                        y={compareY}
                        width={barWidth}
                        height={Math.max(2, compareH)}
                        rx={3}
                        fill={hoveredOrdersIndex === index ? '#94a3b8' : '#cbd5e1'}
                      />
                    ) : null}
                    <rect
                      x={currentX}
                      y={currentY}
                      width={barWidth}
                      height={Math.max(2, currentH)}
                      rx={3}
                      fill={hoveredOrdersIndex === index ? '#f43f5e' : '#0f172a'}
                    />
                    <rect
                      x={xCenter - Math.max(12, barSlot / 2)}
                      y={PADDING.top}
                      width={Math.max(24, barSlot)}
                      height={CHART_HEIGHT - PADDING.top - PADDING.bottom}
                      fill="transparent"
                      onMouseEnter={() => setHoveredOrdersIndex(index)}
                      onMouseLeave={() => setHoveredOrdersIndex(null)}
                    />
                    {index % Math.ceil(points.length / 6) === 0 || index === points.length - 1 ? (
                      <text
                        x={xCenter}
                        y={CHART_HEIGHT - 14}
                        fontSize="11"
                        textAnchor="middle"
                        fill="#64748b"
                      >
                        {point.label}
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}
