import { ProductType } from '@prisma/client'
import Link from 'next/link'

import { formatUAH } from '@/lib/admin-finance'
import {
  calcGrossMarginPercent,
  calcPaymentFeeUAH,
  getUnitCostUAH,
} from '@/lib/finance'
import { TYPE_LABELS } from '@/lib/labels'
import { prisma } from '@/lib/prisma'
import { calcDiscountedPrice } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    q?: string
    type?: string
    costStatus?: string
    sort?: string
    dir?: string
  }>
}

type ProductForCosts = {
  id: string
  name: string
  slug: string
  type: ProductType
  sortCatalog: number
  createdAt: Date
  basePriceUAH: number | null
  costProfile: {
    materialsCostUAH: number
    laborCostUAH: number
    packagingCostUAH: number
    shippingCostUAH: number
    otherCostUAH: number
    notes: string | null
  } | null
  variants: Array<{
    priceUAH: number | null
    discountPercent: number | null
    discountUAH: number | null
  }>
}

type CostStatusFilter = 'all' | 'with' | 'missing'
type CostSortKey =
  | 'catalog'
  | 'name'
  | 'salePrice'
  | 'unitCost'
  | 'paymentFee'
  | 'grossProfit'
  | 'margin'
type SortDirection = 'asc' | 'desc'

function getReferenceSalePrice(product: ProductForCosts) {
  const firstVariant = product.variants[0]
  const { finalPriceUAH } = calcDiscountedPrice({
    basePriceUAH: firstVariant?.priceUAH ?? product.basePriceUAH ?? 0,
    discountPercent: firstVariant?.discountPercent,
    discountUAH: firstVariant?.discountUAH,
  })

  return finalPriceUAH
}

function getValidProductType(value?: string): ProductType | undefined {
  const productTypes = Object.keys(TYPE_LABELS) as ProductType[]
  return productTypes.includes(value as ProductType) ? (value as ProductType) : undefined
}

function getValidCostStatus(value?: string): CostStatusFilter {
  return value === 'with' || value === 'missing' ? value : 'all'
}

function getValidCostSortKey(value?: string): CostSortKey {
  const allowed: CostSortKey[] = [
    'catalog',
    'name',
    'salePrice',
    'unitCost',
    'paymentFee',
    'grossProfit',
    'margin',
  ]

  return allowed.includes(value as CostSortKey) ? (value as CostSortKey) : 'catalog'
}

function getValidSortDirection(
  value: string | undefined,
  fallback: SortDirection,
): SortDirection {
  return value === 'asc' || value === 'desc' ? value : fallback
}

export default async function AdminCostsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const query = params.q?.trim() ?? ''
  const type = getValidProductType(params.type)
  const costStatus = getValidCostStatus(params.costStatus)
  const sort = getValidCostSortKey(params.sort)
  const dir = getValidSortDirection(params.dir, sort === 'catalog' ? 'asc' : 'desc')

  const products = await prisma.product.findMany({
    where: {
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { slug: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(type ? { type } : {}),
      ...(costStatus === 'with'
        ? { costProfile: { isNot: null } }
        : costStatus === 'missing'
          ? { costProfile: null }
          : {}),
    },
    orderBy: [{ sortCatalog: 'asc' }, { createdAt: 'desc' }],
    include: {
      costProfile: true,
      variants: {
        orderBy: { sortCatalog: 'asc' },
        select: {
          priceUAH: true,
          discountPercent: true,
          discountUAH: true,
        },
      },
    },
  })

  const rows = products
    .map((product) => {
      const salePriceUAH = getReferenceSalePrice(product)
      const unitCostUAH = getUnitCostUAH(product.costProfile)
      const paymentFeeUAH = calcPaymentFeeUAH(salePriceUAH, 'LIQPAY')
      const grossProfitUAH = salePriceUAH - unitCostUAH - paymentFeeUAH
      const marginPercent = calcGrossMarginPercent(
        salePriceUAH,
        unitCostUAH + paymentFeeUAH,
      )

      return {
        product,
        salePriceUAH,
        unitCostUAH,
        paymentFeeUAH,
        grossProfitUAH,
        marginPercent,
      }
    })
    .sort((a, b) => {
      const direction = dir === 'asc' ? 1 : -1

      switch (sort) {
        case 'name':
          return direction * a.product.name.localeCompare(b.product.name, 'uk')
        case 'salePrice':
          return direction * (a.salePriceUAH - b.salePriceUAH)
        case 'unitCost':
          return direction * (a.unitCostUAH - b.unitCostUAH)
        case 'paymentFee':
          return direction * (a.paymentFeeUAH - b.paymentFeeUAH)
        case 'grossProfit':
          return direction * (a.grossProfitUAH - b.grossProfitUAH)
        case 'margin':
          return direction * (a.marginPercent - b.marginPercent)
        case 'catalog':
        default:
          return (
            direction * (a.product.sortCatalog - b.product.sortCatalog) ||
            b.product.createdAt.getTime() - a.product.createdAt.getTime()
          )
      }
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Собівартість</h1>
          <p className="mt-1 text-sm text-gray-600">
            Поточна unit economics по товарах на базі cost profile.
          </p>
        </div>

        <form method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="text-sm font-medium xl:col-span-2">
            Пошук
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Назва або slug"
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm font-medium">
            Тип
            <select
              name="type"
              defaultValue={type ?? ''}
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">Усі</option>
              {(Object.keys(TYPE_LABELS) as ProductType[]).map((value) => (
                <option key={value} value={value}>
                  {TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Cost profile
            <select
              name="costStatus"
              defaultValue={costStatus}
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="all">Усі</option>
              <option value="with">Є калькуляція</option>
              <option value="missing">Немає калькуляції</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            Сортувати
            <select
              name="sort"
              defaultValue={sort}
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="catalog">Каталог</option>
              <option value="name">Назва</option>
              <option value="salePrice">Ціна продажу</option>
              <option value="unitCost">Собівартість</option>
              <option value="paymentFee">Платіжна комісія</option>
              <option value="grossProfit">Валовий прибуток</option>
              <option value="margin">Маржа</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            Напрям
            <select
              name="dir"
              defaultValue={dir}
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="asc">За зростанням</option>
              <option value="desc">За спаданням</option>
            </select>
          </label>

          <div className="flex items-end gap-3 sm:col-span-2 xl:col-span-6">
            <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
              Застосувати
            </button>
            <Link
              href="/admin/costs"
              className="inline-flex items-center justify-center rounded border px-4 py-2 text-sm"
            >
              Скинути
            </Link>
          </div>
        </form>
      </div>

      <section className="overflow-x-auto rounded border bg-white">
        <div className="border-b p-4 text-sm text-gray-600">
          Знайдено товарів: <span className="font-medium text-gray-900">{rows.length}</span>
        </div>

        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Товар</th>
              <th className="p-3 text-left">Тип</th>
              <th className="p-3 text-right">Ціна продажу</th>
              <th className="p-3 text-right">Собівартість</th>
              <th className="p-3 text-right">Платіжна комісія</th>
              <th className="p-3 text-right">Валовий прибуток</th>
              <th className="p-3 text-right">Маржа</th>
              <th className="p-3 text-right">Дії</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-sm text-gray-600">
                  За поточними фільтрами товари не знайдені.
                </td>
              </tr>
            ) : (
              rows.map(
                ({
                  product,
                  salePriceUAH,
                  unitCostUAH,
                  paymentFeeUAH,
                  grossProfitUAH,
                  marginPercent,
                }) => (
                  <tr key={product.id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{product.name}</div>
                      <div className="mt-1 text-xs text-gray-500">{product.slug}</div>
                      {product.costProfile?.notes ? (
                        <div className="mt-1 text-xs text-gray-500">
                          {product.costProfile.notes}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3">{TYPE_LABELS[product.type]}</td>
                    <td className="p-3 text-right">{formatUAH(salePriceUAH)}</td>
                    <td className="p-3 text-right">{formatUAH(unitCostUAH)}</td>
                    <td className="p-3 text-right">{formatUAH(paymentFeeUAH)}</td>
                    <td
                      className={`p-3 text-right ${
                        grossProfitUAH >= 0 ? 'text-green-700' : 'text-red-600'
                      }`}
                    >
                      {formatUAH(grossProfitUAH)}
                    </td>
                    <td className="p-3 text-right">{marginPercent}%</td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Редагувати
                      </Link>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
