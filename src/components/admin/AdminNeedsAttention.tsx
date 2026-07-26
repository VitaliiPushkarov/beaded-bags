import { unstable_cache } from 'next/cache'
import Link from 'next/link'

import { findUnmappedLiqPayEntities } from '@/lib/liqpay-catalog-sync'
import { prisma } from '@/lib/prisma'

// Variants at or below this finished-goods count are surfaced as "low stock"
// (negative counts mean oversold and are included).
const LOW_STOCK_THRESHOLD = 2

// The dashboard is force-dynamic, but this overview panel runs several
// aggregation queries on every load. Cache the counts for a short window —
// up to 60s of staleness is fine for an at-a-glance signal (the edit pages
// it links to are always live).
const getNeedsAttentionCounts = unstable_cache(
  async () => {
    const [lowStockCount, missingCostCount, unmapped] = await Promise.all([
      prisma.productVariantInventory.count({
        where: {
          finishedGoodsQty: { lte: LOW_STOCK_THRESHOLD },
          variant: { product: { status: 'PUBLISHED' } },
        },
      }),
      prisma.product.count({
        where: { status: 'PUBLISHED', costProfile: null },
      }),
      findUnmappedLiqPayEntities(),
    ])
    return {
      lowStockCount,
      missingCostCount,
      missingLiqPayCount: unmapped.items.length,
    }
  },
  ['admin-needs-attention-counts'],
  { revalidate: 60 },
)

type AttentionCard = {
  label: string
  count: number
  href: string
  hint: string
}

export default async function AdminNeedsAttention() {
  const { lowStockCount, missingCostCount, missingLiqPayCount } =
    await getNeedsAttentionCounts()

  const cards: AttentionCard[] = [
    {
      label: 'Товари з низьким запасом',
      count: lowStockCount,
      href: '/admin/inventory/products',
      hint: `Готових виробів ≤ ${LOW_STOCK_THRESHOLD} (включно з відʼємними)`,
    },
    {
      label: 'Без собівартості',
      count: missingCostCount,
      href: '/admin/costs?costStatus=missing',
      hint: 'Опубліковані товари без профілю собівартості',
    },
    {
      label: 'Без LiqPay ID',
      count: missingLiqPayCount,
      href: '/admin/liqpay',
      hint: 'Позиції, які зламають онлайн-оплату',
    },
  ]

  const total = cards.reduce((sum, card) => sum + card.count, 0)

  if (total === 0) {
    return (
      <section
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        role="status"
      >
        Все під контролем — низьких запасів, товарів без собівартості чи без
        LiqPay ID немає.
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-medium">Потребує уваги</h2>
        <p className="mt-1 text-sm text-gray-600">
          Операційні сигнали, які варто закрити.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const active = card.count > 0
          return (
            <Link
              key={card.label}
              href={card.href}
              className={`admin-card p-5 transition hover:border-slate-300 ${
                active ? 'border-amber-300 bg-amber-50' : ''
              }`}
            >
              <div className="text-sm text-slate-600">{card.label}</div>
              <div
                className={`mt-2 text-3xl font-semibold tracking-tight ${
                  active ? 'text-amber-700' : 'text-slate-900'
                }`}
              >
                {card.count}
              </div>
              <div className="mt-1 text-xs text-slate-500">{card.hint}</div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
