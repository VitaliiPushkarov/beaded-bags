import Link from 'next/link'

import { prisma } from '@/lib/prisma'
import {
  buildFinanceProductResolver,
  buildFinanceSummary,
  formatDate,
  formatUAH,
  getDateRangeFromSearchParams,
  resolveOrderFinance,
  toDateInputValue,
} from '@/lib/admin-finance'
import { buildManagedUnitCostUAH } from '@/lib/management-accounting'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    from?: string
    to?: string
  }>
}

export default async function AdminFinancePage({ searchParams }: PageProps) {
  const params = await searchParams
  const { from, to } = getDateRangeFromSearchParams(params)

  const [orders, expenses, purchases] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
      },
    }),
    prisma.expense.findMany({
      where: {
        expenseDate: {
          gte: from,
          lte: to,
        },
      },
      orderBy: { expenseDate: 'desc' },
    }),
    prisma.purchase.findMany({
      where: {
        purchasedAt: {
          gte: from,
          lte: to,
        },
      },
      orderBy: { purchasedAt: 'desc' },
      include: {
        supplier: true,
      },
    }),
  ])

  const productIds = Array.from(
    new Set(
      orders.flatMap((order) =>
        order.items
          .map((item) => item.productId)
          .filter((productId): productId is string => Boolean(productId)),
      ),
    ),
  )

  const products = productIds.length
    ? await prisma.product.findMany({
        where: {
          id: { in: productIds },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          packagingTemplate: {
            select: {
              costUAH: true,
            },
          },
          materialUsages: {
            select: {
              quantity: true,
              material: {
                select: {
                  unitCostUAH: true,
                },
              },
            },
          },
          costProfile: {
            select: {
              materialsCostUAH: true,
              laborCostUAH: true,
              packagingCostUAH: true,
              shippingCostUAH: true,
              otherCostUAH: true,
            },
          },
        },
      })
    : []

  const productResolver = buildFinanceProductResolver(
    products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      unitCostUAH: buildManagedUnitCostUAH({
        profile: product.costProfile,
        materialUsages: product.materialUsages,
        packagingTemplateCostUAH: product.packagingTemplate?.costUAH,
        includeShipping: false,
      }),
    })),
  )

  const summary = buildFinanceSummary({
    orders,
    expenses,
    purchases,
    productResolver,
  })

  const topProducts = Array.from(
    orders
      .filter((order) => order.status === 'PAID' || order.status === 'FULFILLED')
      .flatMap((order) => resolveOrderFinance(order, productResolver).lines)
      .reduce((map, item) => {
        const key = item.key
        const current = map.get(key) || {
          key,
          name: item.name,
          qty: 0,
          revenueUAH: 0,
          costUAH: 0,
          grossProfitUAH: 0,
        }

        current.qty += item.qty
        current.revenueUAH += item.lineRevenueUAH
        current.costUAH += item.totalCostUAH
        current.grossProfitUAH += item.grossProfitUAH

        map.set(key, current)
        return map
      }, new Map<string, {
        key: string
        name: string
        qty: number
        revenueUAH: number
        costUAH: number
        grossProfitUAH: number
      }>())
      .values(),
  )
    .sort((a, b) => b.grossProfitUAH - a.grossProfitUAH)
    .slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Фінанси</h1>
          <p className="text-sm text-gray-600 mt-1">
            Базовий управлінський облік по продажах, собівартості, витратах і закупівлях.
          </p>
        </div>

        <form className="flex flex-col sm:flex-row gap-3">
          <label className="text-sm font-medium">
            Від
            <input
              type="date"
              name="from"
              defaultValue={toDateInputValue(from)}
              className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium">
            До
            <input
              type="date"
              name="to"
              defaultValue={toDateInputValue(to)}
              className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <div className="sm:self-end">
            <button className="inline-flex items-center justify-center rounded bg-black text-white px-4 py-2 text-sm hover:bg-[#FF3D8C]">
              Оновити
            </button>
          </div>
        </form>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          ['Виручка підтверджена', formatUAH(summary.recognizedRevenueUAH)],
          ['Замовлень активних', String(summary.activeOrdersCount)],
          ['Середній чек', formatUAH(summary.avgOrderValueUAH)],
          ['COGS', formatUAH(summary.itemsCostUAH)],
          ['Платіжні комісії', formatUAH(summary.paymentFeeUAH)],
          ['Валовий прибуток', formatUAH(summary.grossProfitUAH)],
          ['OPEX (реклама + доставка матеріалів)', formatUAH(summary.operatingExpensesUAH)],
          ['Інші витрати', formatUAH(summary.otherExpensesUAH)],
          ['Cash out на закупівлі', formatUAH(summary.purchaseCashOutUAH)],
          ['Результат після OPEX', formatUAH(summary.netAfterExpensesUAH)],
        ].map(([label, value]) => (
          <div key={label} className="border rounded bg-white p-4">
            <div className="text-sm text-gray-500">{label}</div>
            <div className="text-2xl font-semibold mt-2">{value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="border rounded bg-white overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium">Топ товарів по валовому прибутку</h2>
            <Link href="/admin/costs" className="text-sm text-blue-600 hover:underline">
              Собівартість
            </Link>
          </div>

          {topProducts.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">
              За вибраний період ще немає оплачених замовлень.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">Товар</th>
                    <th className="p-3 text-right">К-сть</th>
                    <th className="p-3 text-right">Виручка</th>
                    <th className="p-3 text-right">COGS</th>
                    <th className="p-3 text-right">GP</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((item) => (
                    <tr key={item.key} className="border-t">
                      <td className="p-3">{item.name}</td>
                      <td className="p-3 text-right">{item.qty}</td>
                      <td className="p-3 text-right">{formatUAH(item.revenueUAH)}</td>
                      <td className="p-3 text-right">{formatUAH(item.costUAH)}</td>
                      <td className="p-3 text-right">{formatUAH(item.grossProfitUAH)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="border rounded bg-white overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between gap-4">
              <h2 className="text-lg font-medium">Останні витрати</h2>
              <Link href="/admin/expenses" className="text-sm text-blue-600 hover:underline">
                Усі витрати
              </Link>
            </div>
            <div className="divide-y">
              {expenses.slice(0, 8).map((expense) => (
                <div key={expense.id} className="p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{expense.title}</div>
                    <div className="text-sm text-gray-500">
                      {formatDate(expense.expenseDate)}
                    </div>
                  </div>
                  <div className="font-medium">{formatUAH(expense.amountUAH)}</div>
                </div>
              ))}
              {expenses.length === 0 ? (
                <div className="p-4 text-sm text-gray-600">Немає витрат за період.</div>
              ) : null}
            </div>
          </div>

          <div className="border rounded bg-white overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between gap-4">
              <h2 className="text-lg font-medium">Останні закупівлі</h2>
              <Link href="/admin/purchases" className="text-sm text-blue-600 hover:underline">
                Усі закупівлі
              </Link>
            </div>
            <div className="divide-y">
              {purchases.slice(0, 8).map((purchase) => (
                <div key={purchase.id} className="p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{purchase.supplier.name}</div>
                    <div className="text-sm text-gray-500">
                      {formatDate(purchase.purchasedAt)}
                    </div>
                  </div>
                  <div className="font-medium">{formatUAH(purchase.totalUAH)}</div>
                </div>
              ))}
              {purchases.length === 0 ? (
                <div className="p-4 text-sm text-gray-600">Немає закупівель за період.</div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
