import Link from 'next/link'

import { prisma } from '@/lib/prisma'
import {
  buildFinanceProductResolver,
  buildFinanceSummary,
  formatUAH,
  startOfMonth,
} from '@/lib/admin-finance'
import { buildManagedUnitCostUAH } from '@/lib/management-accounting'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const now = new Date()
  const from = startOfMonth(now)

  const [orders, expenses, purchases] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: from,
          lte: now,
        },
      },
      include: {
        items: true,
      },
    }),
    prisma.expense.findMany({
      where: {
        expenseDate: {
          gte: from,
          lte: now,
        },
      },
    }),
    prisma.purchase.findMany({
      where: {
        purchasedAt: {
          gte: from,
          lte: now,
        },
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

  const links = [
    {
      href: '/admin/products',
      title: 'Товари',
      description: 'Каталог і картки товарів',
    },
    {
      href: '/admin/orders',
      title: 'Замовлення',
      description: 'Статуси й деталі оформлених замовлень',
    },
    {
      href: '/admin/costs',
      title: 'Собівартість',
      description: 'Unit economics по товарах',
    },
    {
      href: '/admin/inventory',
      title: 'Запаси',
      description: 'Залишки готових товарів і матеріали на виробництво',
    },
    {
      href: '/admin/production',
      title: 'Виробництво',
      description: 'Production batch: списання матеріалів і прихід товарів',
    },
    {
      href: '/admin/expenses',
      title: 'Витрати',
      description: 'Операційні витрати по категоріях',
    },
    {
      href: '/admin/purchases',
      title: 'Закупівлі',
      description: 'Реєстр закупівель і приходи',
    },
    {
      href: '/admin/finance',
      title: 'Фінанси',
      description: 'P&L',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Адмін-панель GERDAN</h1>
        <p className="text-sm text-gray-600 mt-1">
          Товари, замовлення і управлінський облік.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="border rounded bg-[#c2e8b0] p-4">
          <div className="text-sm text-gray-900">Виручка за місяць</div>
          <div className="text-2xl font-semibold mt-2">
            {formatUAH(summary.recognizedRevenueUAH)}
          </div>
        </div>
        <div className="border rounded bg-[#c2e8b0] p-4">
          <div className="text-sm text-gray-900">Валовий прибуток</div>
          <div className="text-2xl font-semibold mt-2">
            {formatUAH(summary.grossProfitUAH)}
          </div>
        </div>
        <div className="border rounded bg-[#c2e8b0] p-4">
          <div className="text-sm text-gray-900">Операційні витрати</div>
          <div className="text-2xl font-semibold mt-2">
            {formatUAH(summary.operatingExpensesUAH)}
          </div>
        </div>
        <div className="border rounded bg-[#c2e8b0] p-4">
          <div className="text-sm text-gray-900">Закупівлі (cash out)</div>
          <div className="text-2xl font-semibold mt-2">
            {formatUAH(summary.purchaseCashOutUAH)}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="border rounded bg-[#4117ff] p-4 hover:border-black transition-colors hover:bg-pink-300 "
          >
            <div className="font-medium text-white ">{link.title}</div>
            <div className="text-sm text-gray-200 mt-1 ">
              {link.description}
            </div>
          </Link>
        ))}
      </section>
    </div>
  )
}
