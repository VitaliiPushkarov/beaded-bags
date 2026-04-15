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
  endOfDay,
  formatDate,
  formatUAH,
  getDateRangeFromSearchParams,
  resolveOrderFinance,
  startOfDay,
  toDateInputValue,
} from '@/lib/admin-finance'
import { buildManagedUnitCostUAH } from '@/lib/management-accounting'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    from?: string
    to?: string
    preset?: string
  }>
}

type QuickRange = {
  key: string
  label: string
  from: Date
  to: Date
}

function startOfQuarter(date: Date): Date {
  const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3
  return new Date(date.getFullYear(), quarterStartMonth, 1)
}

export default async function AdminFinancePage({ searchParams }: PageProps) {
  const params = await searchParams
  const { from, to } = getDateRangeFromSearchParams(params)
  const now = new Date()
  const todayEnd = endOfDay(now)
  const quickRanges: QuickRange[] = [
    {
      key: '7d',
      label: '7 днів',
      from: startOfDay(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6),
      ),
      to: todayEnd,
    },
    {
      key: '30d',
      label: '30 днів',
      from: startOfDay(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29),
      ),
      to: todayEnd,
    },
    {
      key: 'month',
      label: 'Місяць',
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: todayEnd,
    },
    {
      key: 'quarter',
      label: 'Квартал',
      from: startOfQuarter(now),
      to: todayEnd,
    },
  ]
  const selectedFromValue = toDateInputValue(from)
  const selectedToValue = toDateInputValue(to)
  const selectedQuickRangeKey = quickRanges.some(
    (range) => range.key === params.preset,
  )
    ? params.preset!
    : (quickRanges.find((range) => {
        const rangeFromValue = toDateInputValue(range.from)
        const rangeToValue = toDateInputValue(range.to)
        return (
          selectedFromValue === rangeFromValue &&
          selectedToValue === rangeToValue
        )
      })?.key ?? null)

  const [orders, expenses, materials] = await Promise.all([
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
    prisma.material.findMany({
      select: {
        stockQty: true,
        unitCostUAH: true,
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

  const materialsCatalogTotalUAH = Math.round(
    materials.reduce(
      (sum, material) =>
        sum + Math.max(0, material.stockQty) * Math.max(0, material.unitCostUAH),
      0,
    ),
  )

  const summary = buildFinanceSummary({
    orders,
    expenses,
    materialsCatalogTotalUAH,
    productResolver,
  })
  const recognizedRevenueUAH = summary.recognizedRevenueUAH
  const grossMarginPercent =
    recognizedRevenueUAH > 0
      ? Math.round((summary.grossProfitUAH / recognizedRevenueUAH) * 100)
      : 0
  const cogsSharePercent =
    recognizedRevenueUAH > 0
      ? Math.round((summary.itemsCostUAH / recognizedRevenueUAH) * 100)
      : 0
  const paymentFeeSharePercent =
    recognizedRevenueUAH > 0
      ? Math.round((summary.paymentFeeUAH / recognizedRevenueUAH) * 100)
      : 0
  const operatingSharePercent =
    recognizedRevenueUAH > 0
      ? Math.round((summary.operatingExpensesUAH / recognizedRevenueUAH) * 100)
      : 0
  const otherSharePercent =
    recognizedRevenueUAH > 0
      ? Math.round((summary.otherExpensesUAH / recognizedRevenueUAH) * 100)
      : 0
  const netMarginPercent =
    recognizedRevenueUAH > 0
      ? Math.round((summary.netAfterExpensesUAH / recognizedRevenueUAH) * 100)
      : 0
  const totalManagedExpensesUAH =
    summary.operatingExpensesUAH +
    summary.otherExpensesUAH
  const netAfterAllExpensesUAH =
    summary.grossProfitUAH - totalManagedExpensesUAH
  const totalExpenseLoadPercent =
    recognizedRevenueUAH > 0
      ? Math.round((totalManagedExpensesUAH / recognizedRevenueUAH) * 100)
      : 0
  const netAfterAllMarginPercent =
    recognizedRevenueUAH > 0
      ? Math.round((netAfterAllExpensesUAH / recognizedRevenueUAH) * 100)
      : 0

  const soldProducts = Array.from(
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
  const topProducts = [...soldProducts]
    .sort((a, b) => b.grossProfitUAH - a.grossProfitUAH)
    .slice(0, 10)
  const soldProductsByRevenue = [...soldProducts].sort(
    (a, b) => b.revenueUAH - a.revenueUAH,
  )
  const soldProductsTopFive = soldProductsByRevenue.slice(0, 5)
  const soldProductsHidden = soldProductsByRevenue.slice(5)
  const soldProductsTotalQty = soldProducts.reduce(
    (sum, item) => sum + item.qty,
    0,
  )
  const soldProductsTotalRevenueUAH = soldProducts.reduce(
    (sum, item) => sum + item.revenueUAH,
    0,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Фінанси</h1>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {quickRanges.map((range) => {
              const rangeFromValue = toDateInputValue(range.from)
              const rangeToValue = toDateInputValue(range.to)
              const isActive = selectedQuickRangeKey === range.key
              const href = `/admin/finance?${new URLSearchParams({
                from: rangeFromValue,
                to: rangeToValue,
                preset: range.key,
              }).toString()}`

              return (
                <Link
                  key={range.key}
                  href={href}
                  className={buttonVariants({
                    variant: isActive ? 'default' : 'outline',
                    size: 'sm',
                  })}
                >
                  {range.label}
                </Link>
              )
            })}
          </div>
          <form
            action="/admin/finance"
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="space-y-1.5">
              <Label htmlFor="finance-from">Від:</Label>
              <Input
                id="finance-from"
                type="date"
                name="from"
                defaultValue={selectedFromValue}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finance-to">До:</Label>
              <Input
                id="finance-to"
                type="date"
                name="to"
                defaultValue={selectedToValue}
              />
            </div>
            <button className={buttonVariants({ variant: 'default' })}>
              Оновити
            </button>
            <Link
              href="/admin/finance"
              className={buttonVariants({ variant: 'outline' })}
            >
              Скинути
            </Link>
          </form>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Загальна картина</h2>
          <p className="text-sm text-gray-600">
            Коротко про замовлення за період і скільки грошей залишилось.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Активні замовлення', String(summary.activeOrdersCount)],
            ['Підтверджені замовлення', String(summary.recognizedOrdersCount)],
            ['Сума підтверджених замовлень', formatUAH(summary.recognizedRevenueUAH)],
            [
              'Залишок після всіх витрат',
              formatUAH(netAfterAllExpensesUAH),
            ],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-500">{label}</div>
                <div className="mt-2 text-2xl font-semibold">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          Частка, що залишилась після всіх витрат:{' '}
          <b>{netAfterAllMarginPercent}%</b>.
          <span className="ml-2 text-slate-500">
            Після щоденних витрат: <b>{netMarginPercent}%</b>.
          </span>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Продажі</h2>
          <p className="text-sm text-gray-600">
            Показуємо, скільки продали, скільки це коштувало і що залишилось.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            ['Середній чек', formatUAH(summary.avgOrderValueUAH)],
            ['Собівартість проданих товарів', formatUAH(summary.itemsCostUAH)],
            ['Платіжні комісії', formatUAH(summary.paymentFeeUAH)],
            ['Прибуток до інших витрат', formatUAH(summary.grossProfitUAH)],
            ['Частка прибутку до інших витрат', `${grossMarginPercent}%`],
            ['Частка собівартості у сумі продажів', `${cogsSharePercent}%`],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-500">{label}</div>
                <div className="mt-2 text-2xl font-semibold">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          Комісії займають <b>{paymentFeeSharePercent}%</b> від суми
          підтверджених продажів.
        </div>
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-200 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <CardTitle>Топ товарів за прибутком</CardTitle>
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
                    <TableHead className="text-right">Собівартість</TableHead>
                    <TableHead className="text-right">Прибуток</TableHead>
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
          <CardHeader className="border-b border-slate-200">
            <CardTitle>Продані товари: к-сть і загальна сума</CardTitle>
            <CardDescription>
              Аналіз проданих товарів за оплаченими/виконаними замовленнями.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {soldProductsByRevenue.length === 0 ? (
              <div className="p-4 text-sm text-gray-600">
                За вибраний період ще немає проданих товарів.
              </div>
            ) : (
              <>
                <Table className="table-fixed">
                  <colgroup>
                    <col />
                    <col className="w-[180px]" />
                    <col className="w-[220px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Товар</TableHead>
                      <TableHead className="text-right">Продано, шт</TableHead>
                      <TableHead className="text-right">Загальна сума</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {soldProductsTopFive.map((item) => (
                      <TableRow key={`sold-${item.key}`}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right">{item.qty}</TableCell>
                        <TableCell className="text-right">
                          {formatUAH(item.revenueUAH)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {soldProductsHidden.length > 0 ? (
                  <details className="group flex flex-col-reverse border-t">
                    <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm text-slate-700 hover:bg-slate-50">
                      <span className="group-open:hidden">
                        Показати ще {soldProductsHidden.length} товарів
                      </span>
                      <span className="hidden group-open:inline">Згорнути</span>
                      <span className="text-sm text-slate-500 transition-transform group-open:rotate-180">
                        ▾
                      </span>
                    </summary>
                    <Table className="table-fixed">
                      <colgroup>
                        <col />
                        <col className="w-[180px]" />
                        <col className="w-[220px]" />
                      </colgroup>
                      <TableBody>
                        {soldProductsHidden.map((item) => (
                          <TableRow key={`sold-hidden-${item.key}`}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell className="text-right">{item.qty}</TableCell>
                            <TableCell className="text-right">
                              {formatUAH(item.revenueUAH)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </details>
                ) : null}

                <Table className="table-fixed border-t">
                  <colgroup>
                    <col />
                    <col className="w-[180px]" />
                    <col className="w-[220px]" />
                  </colgroup>
                  <TableBody>
                    <TableRow className="bg-slate-50 font-medium">
                      <TableCell>Всього</TableCell>
                      <TableCell className="text-right">
                        {soldProductsTotalQty}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatUAH(soldProductsTotalRevenueUAH)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Витрати</h2>
          <p className="text-sm text-gray-600">
            Операційні та інші витрати за період + сума матеріалів з довідника.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Операційні витрати', formatUAH(summary.operatingExpensesUAH)],
            ['Інші витрати', formatUAH(summary.otherExpensesUAH)],
            [
              'Матеріали у довіднику (всього)',
              formatUAH(summary.materialsCatalogTotalUAH),
            ],
            ['Усього витрат за період', formatUAH(totalManagedExpensesUAH)],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-500">{label}</div>
                <div className="mt-2 text-2xl font-semibold">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          Як витрати співвідносяться з сумою продажів: операційні{' '}
          <b>{operatingSharePercent}%</b>, інші <b>{otherSharePercent}%</b>,
          разом <b>{totalExpenseLoadPercent}%</b>.
          <span className="ml-2 text-slate-500">
            Сума матеріалів у довіднику не прив&apos;язана до періоду.
          </span>
        </div>

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
                  <div className="font-medium">
                    {formatUAH(expense.amountUAH)}
                  </div>
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
