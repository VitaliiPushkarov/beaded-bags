import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

  const [orders, expenses] = await Promise.all([
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
              variantColor: true,
              material: {
                select: {
                  unitCostUAH: true,
                },
              },
            },
          },
          costProfile: {
            select: {
              laborCostUAH: true,
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
    purchases: [],
    productResolver,
  })

  const topProducts = Array.from(
    orders
      .filter(
        (order) => order.status === 'PAID' || order.status === 'FULFILLED',
      )
      .flatMap((order) => resolveOrderFinance(order, productResolver).lines)
      .reduce(
        (map, item) => {
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
        },
        new Map<
          string,
          {
            key: string
            name: string
            qty: number
            revenueUAH: number
            costUAH: number
            grossProfitUAH: number
          }
        >(),
      )
      .values(),
  )
    .sort((a, b) => b.grossProfitUAH - a.grossProfitUAH)
    .slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Фінанси</h1>
          <p className="mt-1 text-sm text-gray-600">
            Базовий управлінський облік по продажах, собівартості та витратах.
          </p>
        </div>

        <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="finance-from">Від</Label>
            <Input
              id="finance-from"
              type="date"
              name="from"
              defaultValue={toDateInputValue(from)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="finance-to">До</Label>
            <Input
              id="finance-to"
              type="date"
              name="to"
              defaultValue={toDateInputValue(to)}
            />
          </div>
          <button className={buttonVariants({ variant: 'default' })}>
            Оновити
          </button>
        </form>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          ['Виручка підтверджена', formatUAH(summary.recognizedRevenueUAH)],
          ['Замовлень активних', String(summary.activeOrdersCount)],
          ['Середній чек', formatUAH(summary.avgOrderValueUAH)],
          [
            'Собівартість реалізованих товарів',
            formatUAH(summary.itemsCostUAH),
          ],
          ['Платіжні комісії', formatUAH(summary.paymentFeeUAH)],
          ['Валовий прибуток', formatUAH(summary.grossProfitUAH)],
          ['Операційні витрати', formatUAH(summary.operatingExpensesUAH)],
          ['Інші витрати', formatUAH(summary.otherExpensesUAH)],
          [
            'Результат після Опер. витрат',
            formatUAH(summary.netAfterExpensesUAH),
          ],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-500">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-200 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <CardTitle>Топ товарів по валовому прибутку</CardTitle>
            <Link
              href="/admin/costs"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Собівартість
            </Link>
          </CardHeader>

          <CardContent className="p-0">
            {topProducts.length === 0 ? (
              <div className="p-4 text-sm text-gray-600">
                За вибраний період ще немає оплачених замовлень.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Товар</TableHead>
                    <TableHead className="text-right">К-сть</TableHead>
                    <TableHead className="text-right">Виручка</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">GP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((item) => (
                    <TableRow key={item.key}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-right">{item.qty}</TableCell>
                      <TableCell className="text-right">
                        {formatUAH(item.revenueUAH)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatUAH(item.costUAH)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatUAH(item.grossProfitUAH)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-200 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <CardTitle>Останні витрати</CardTitle>
            <Link
              href="/admin/expenses"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Усі витрати
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {expenses.slice(0, 8).map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-start justify-between gap-4 p-4"
                >
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
                <div className="p-4 text-sm text-gray-600">
                  Немає витрат за період.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
