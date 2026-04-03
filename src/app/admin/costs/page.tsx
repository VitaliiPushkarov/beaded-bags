import { ProductType } from '@prisma/client'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { formatUAH } from '@/lib/admin-finance'
import {
  calcGrossMarginPercent,
  calcPaymentFeeUAH,
} from '@/lib/finance'
import { ACTIVE_PRODUCT_TYPES, TYPE_LABELS } from '@/lib/labels'
import {
  buildManagedUnitCostUAH,
  calculateMaterialsCostFromUsages,
} from '@/lib/management-accounting'
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
    editProductId?: string
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
    laborCostUAH: number
    shippingCostUAH: number
    otherCostUAH: number
    notes: string | null
  } | null
  packagingTemplate: {
    costUAH: number
  } | null
  materialUsages: Array<{
    quantity: number
    notes: string | null
    material: {
      unitCostUAH: number
    }
  }>
  variants: Array<{
    id: string
    color: string | null
    sku: string | null
    sortCatalog: number | null
    priceUAH: number | null
    discountPercent: number | null
    discountUAH: number | null
  }>
}

type VariantForCosts = ProductForCosts['variants'][number]

type CostRow = {
  product: ProductForCosts
  variant: VariantForCosts | null
  variantLabel: string
  salePriceUAH: number
  materialsCostUAH: number
  packagingCostUAH: number
  laborCostUAH: number
  shippingCostUAH: number
  otherCostUAH: number
  unitCostUAH: number
  unitCostWithShippingUAH: number
  paymentFeeUAH: number
  grossProfitUAH: number
  marginPercent: number
  readiness: 'ready' | 'attention'
  readinessIssues: string[]
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

const CostAssemblySchema = z.object({
  productId: z.string().min(1),
  laborCostUAH: z.coerce.number().int().min(0).default(0),
  shippingCostUAH: z.coerce.number().int().min(0).default(0),
  otherCostUAH: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().optional(),
  returnTo: z.string().trim().optional(),
})

function getVariantLabel(variant: VariantForCosts | null): string {
  if (!variant) return 'Базовий товар'

  const details: string[] = []
  if (variant.color?.trim()) details.push(variant.color.trim())
  if (variant.sku?.trim()) details.push(`SKU: ${variant.sku.trim()}`)

  if (details.length) return details.join(' • ')
  return `Варіант ${variant.id.slice(-6)}`
}

function getVariantSalePrice(product: ProductForCosts, variant: VariantForCosts | null) {
  const { finalPriceUAH } = calcDiscountedPrice({
    basePriceUAH: variant?.priceUAH ?? product.basePriceUAH ?? 0,
    discountPercent: variant?.discountPercent,
    discountUAH: variant?.discountUAH,
  })

  return finalPriceUAH
}

function getValidProductType(value?: string): ProductType | undefined {
  const raw = value as ProductType | undefined
  const normalized = raw === 'ORNAMENTS' ? 'ACCESSORY' : raw
  return ACTIVE_PRODUCT_TYPES.includes(normalized as ProductType)
    ? (normalized as ProductType)
    : undefined
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
  const editProductId = params.editProductId?.trim() ?? ''

  function buildCostsHref(input?: { editProductId?: string }) {
    const qs = new URLSearchParams()
    if (query) qs.set('q', query)
    if (type) qs.set('type', type)
    if (costStatus !== 'all') qs.set('costStatus', costStatus)
    if (sort !== 'catalog') qs.set('sort', sort)
    if (dir !== (sort === 'catalog' ? 'asc' : 'desc')) qs.set('dir', dir)
    if (input?.editProductId) qs.set('editProductId', input.editProductId)

    const queryString = qs.toString()
    return queryString ? `/admin/costs?${queryString}` : '/admin/costs'
  }

  async function updateCostAssembly(formData: FormData) {
    'use server'

    const parsed = CostAssemblySchema.safeParse({
      productId: formData.get('productId'),
      laborCostUAH: formData.get('laborCostUAH'),
      shippingCostUAH: formData.get('shippingCostUAH'),
      otherCostUAH: formData.get('otherCostUAH'),
      notes: formData.get('notes'),
      returnTo: formData.get('returnTo'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося зберегти збірку собівартості')
    }

    await prisma.productCostProfile.upsert({
      where: { productId: parsed.data.productId },
      create: {
        productId: parsed.data.productId,
        laborCostUAH: parsed.data.laborCostUAH,
        shippingCostUAH: parsed.data.shippingCostUAH,
        otherCostUAH: parsed.data.otherCostUAH,
        notes: parsed.data.notes || null,
      },
      update: {
        laborCostUAH: parsed.data.laborCostUAH,
        shippingCostUAH: parsed.data.shippingCostUAH,
        otherCostUAH: parsed.data.otherCostUAH,
        notes: parsed.data.notes || null,
      },
    })

    revalidatePath('/admin/costs')
    revalidatePath('/admin/finance')
    revalidatePath('/admin/orders')
    revalidatePath('/admin')

    const returnTo = parsed.data.returnTo || '/admin/costs'
    if (returnTo.startsWith('/admin/costs')) {
      redirect(returnTo)
    }
    redirect('/admin/costs')
  }

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
      ...(type === 'ACCESSORY'
        ? { type: { in: ['ACCESSORY', 'ORNAMENTS'] } }
        : type
          ? { type }
          : {}),
      ...(costStatus === 'with'
        ? { costProfile: { isNot: null } }
        : costStatus === 'missing'
          ? { costProfile: null }
          : {}),
    },
    orderBy: [{ sortCatalog: 'asc' }, { createdAt: 'desc' }],
    include: {
      costProfile: true,
      packagingTemplate: {
        select: {
          costUAH: true,
        },
      },
      materialUsages: {
        select: {
          quantity: true,
          variantColor: true,
          notes: true,
          material: {
            select: {
              unitCostUAH: true,
            },
          },
        },
      },
      variants: {
        orderBy: { sortCatalog: 'asc' },
        select: {
          id: true,
          color: true,
          sku: true,
          sortCatalog: true,
          priceUAH: true,
          discountPercent: true,
          discountUAH: true,
        },
      },
    },
  })

  const rows = products
    .flatMap<CostRow>((product) => {
      const variants = product.variants.length ? product.variants : [null]

      return variants.map((variant) => {
        const materialsCostUAH = calculateMaterialsCostFromUsages(
          product.materialUsages,
          variant?.color,
        )
        const packagingCostUAH = Math.round(
          Math.max(0, product.packagingTemplate?.costUAH ?? 0),
        )
        const laborCostUAH = Math.round(
          Math.max(0, product.costProfile?.laborCostUAH ?? 0),
        )
        const shippingCostUAH = Math.round(
          Math.max(0, product.costProfile?.shippingCostUAH ?? 0),
        )
        const otherCostUAH = Math.round(
          Math.max(0, product.costProfile?.otherCostUAH ?? 0),
        )
        const unitCostUAH = buildManagedUnitCostUAH({
          profile: product.costProfile,
          materialUsages: product.materialUsages,
          packagingTemplateCostUAH: product.packagingTemplate?.costUAH,
          includeShipping: false,
          variantColor: variant?.color,
        })
        const unitCostWithShippingUAH = buildManagedUnitCostUAH({
          profile: product.costProfile,
          materialUsages: product.materialUsages,
          packagingTemplateCostUAH: product.packagingTemplate?.costUAH,
          includeShipping: true,
          variantColor: variant?.color,
        })
        const salePriceUAH = getVariantSalePrice(product, variant)
        const paymentFeeUAH = calcPaymentFeeUAH(salePriceUAH, 'LIQPAY')
        const grossProfitUAH = salePriceUAH - unitCostUAH - paymentFeeUAH
        const marginPercent = calcGrossMarginPercent(
          salePriceUAH,
          unitCostUAH + paymentFeeUAH,
        )
        const readinessIssues: string[] = []
        if (product.materialUsages.length === 0) {
          readinessIssues.push('Не додані матеріали')
        } else if (materialsCostUAH <= 0) {
          readinessIssues.push('Нульова вартість матеріалів')
        }
        if (!product.packagingTemplate) {
          readinessIssues.push('Не задано пакування')
        }
        if (laborCostUAH <= 0) {
          readinessIssues.push('Не задана оплата роботи')
        }
        if (salePriceUAH > 0 && unitCostUAH >= salePriceUAH) {
          readinessIssues.push('Собівартість >= ціни продажу')
        }
        const readiness: CostRow['readiness'] =
          readinessIssues.length === 0 ? 'ready' : 'attention'

        return {
          product,
          variant,
          variantLabel: getVariantLabel(variant),
          salePriceUAH,
          materialsCostUAH,
          packagingCostUAH,
          laborCostUAH,
          shippingCostUAH,
          otherCostUAH,
          unitCostUAH,
          unitCostWithShippingUAH,
          paymentFeeUAH,
          grossProfitUAH,
          marginPercent,
          readiness,
          readinessIssues,
        }
      })
    })
    .sort((a, b) => {
      const direction = dir === 'asc' ? 1 : -1

      switch (sort) {
        case 'name':
          return (
            direction *
            `${a.product.name} ${a.variantLabel}`.localeCompare(
              `${b.product.name} ${b.variantLabel}`,
              'uk',
            )
          )
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
            direction *
              ((a.variant?.sortCatalog ?? 0) - (b.variant?.sortCatalog ?? 0)) ||
            b.product.createdAt.getTime() - a.product.createdAt.getTime()
        )
      }
    })
  const readyRowsCount = rows.filter((row) => row.readiness === 'ready').length
  const attentionRowsCount = rows.length - readyRowsCount

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Собівартість</h1>
          <p className="mt-1 text-sm text-gray-600">
            Збірка собівартості: матеріали та пакування із Запасів + ручні
            витрати на одиницю.
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
              {ACTIVE_PRODUCT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Збірка
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

      <section className="space-y-3">
        <div className="rounded border bg-white p-4 text-sm text-gray-600">
          Знайдено варіантів:{' '}
          <span className="font-medium text-gray-900">{rows.length}</span>
          {' · '}Повна калькуляція:{' '}
          <span className="font-medium text-green-700">{readyRowsCount}</span>
          {' · '}Потребує уваги:{' '}
          <span className="font-medium text-amber-700">{attentionRowsCount}</span>
        </div>
        <div className="rounded border border-blue-100 bg-blue-50 p-4 text-xs text-blue-900">
          Для замовлень використовується собівартість <b>без доставки</b>:
          матеріали + пакування + робота + інші витрати. Доставка на 1 шт
          показується окремо як повна планова собівартість.
        </div>

        {rows.length === 0 ? (
          <div className="rounded border bg-white p-4 text-sm text-gray-600">
            За поточними фільтрами товари не знайдені.
          </div>
        ) : (
          rows.map(
            ({
              product,
              variant,
              variantLabel,
              salePriceUAH,
              materialsCostUAH,
              packagingCostUAH,
              laborCostUAH,
              shippingCostUAH,
              otherCostUAH,
              unitCostUAH,
              unitCostWithShippingUAH,
              paymentFeeUAH,
              grossProfitUAH,
              marginPercent,
              readiness,
              readinessIssues,
            }) => (
              <details
                key={`${product.id}-${variant?.id ?? 'base'}`}
                id={`cost-product-${product.id}-${variant?.id ?? 'base'}`}
                className="overflow-hidden rounded border bg-white"
                open={editProductId === product.id}
              >
                <summary className="cursor-pointer list-none p-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(5,minmax(120px,1fr))_90px] lg:items-center">
                    <div className="min-w-0">
                      <div className="font-medium">{product.name}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {TYPE_LABELS[product.type]} • {variantLabel}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${
                            readiness === 'ready'
                              ? 'border-green-300 bg-green-50 text-green-700'
                              : 'border-amber-300 bg-amber-50 text-amber-800'
                          }`}
                        >
                          {readiness === 'ready'
                            ? 'Калькуляція повна'
                            : 'Потребує уваги'}
                        </span>
                        {readinessIssues.length > 0 ? (
                          <span className="text-[11px] text-amber-800">
                            {readinessIssues.join(' · ')}
                          </span>
                        ) : null}
                      </div>
                      {product.costProfile?.notes ? (
                        <div className="mt-1 text-xs text-gray-500">
                          {product.costProfile.notes}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-sm lg:text-right">
                      <div className="text-xs text-gray-500">Ціна продажу</div>
                      <div className="font-medium">{formatUAH(salePriceUAH)}</div>
                    </div>

                    <div className="text-sm lg:text-right">
                      <div className="text-xs text-gray-500">Собівартість</div>
                      <div className="font-medium">{formatUAH(unitCostUAH)}</div>
                    </div>

                    <div className="text-sm lg:text-right">
                      <div className="text-xs text-gray-500">Комісія</div>
                      <div className="font-medium">{formatUAH(paymentFeeUAH)}</div>
                    </div>

                    <div className="text-sm lg:text-right">
                      <div className="text-xs text-gray-500">Валовий</div>
                      <div
                        className={
                          grossProfitUAH >= 0
                            ? 'font-medium text-green-700'
                            : 'font-medium text-red-600'
                        }
                      >
                        {formatUAH(grossProfitUAH)}
                      </div>
                    </div>

                    <div className="text-sm lg:text-right">
                      <div className="text-xs text-gray-500">Маржа</div>
                      <div className="font-medium">{marginPercent}%</div>
                    </div>

                    <div className="inline-flex items-center justify-end gap-2 text-xs text-gray-500">
                      <span>Збірка</span>
                      <span className="text-sm leading-none">▾</span>
                    </div>
                  </div>
                </summary>

                <div className="border-t p-4 sm:p-5 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                    <div className="rounded border bg-gray-50 p-3">
                      <div className="text-xs text-gray-500">
                        Матеріали (на варіант)
                      </div>
                      <div className="mt-1 font-medium">{formatUAH(materialsCostUAH)}</div>
                    </div>
                    <div className="rounded border bg-gray-50 p-3">
                      <div className="text-xs text-gray-500">
                        Пакування (шаблон)
                      </div>
                      <div className="mt-1 font-medium">{formatUAH(packagingCostUAH)}</div>
                    </div>
                    <div className="rounded border bg-gray-50 p-3">
                      <div className="text-xs text-gray-500">
                        Робота за 1 сумку
                      </div>
                      <div className="mt-1 font-medium">{formatUAH(laborCostUAH)}</div>
                    </div>
                    <div className="rounded border bg-gray-50 p-3">
                      <div className="text-xs text-gray-500">
                        Доставка на 1 шт
                      </div>
                      <div className="mt-1 font-medium">
                        {formatUAH(shippingCostUAH)}
                      </div>
                    </div>
                    <div className="rounded border bg-gray-50 p-3">
                      <div className="text-xs text-gray-500">
                        Інші витрати на 1 шт
                      </div>
                      <div className="mt-1 font-medium">{formatUAH(otherCostUAH)}</div>
                    </div>
                    <div className="rounded border bg-slate-100 p-3">
                      <div className="text-xs text-gray-500">
                        Повна собівартість (з доставкою)
                      </div>
                      <div className="mt-1 font-semibold">
                        {formatUAH(unitCostWithShippingUAH)}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-600">
                    Шаблон пакування і матеріали редагуються в{' '}
                    <Link
                      href={`/admin/inventory/products?productId=${product.id}#product-${product.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Запасах
                    </Link>
                    .
                  </div>

                  <form
                    action={updateCostAssembly}
                    className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
                  >
                    <input type="hidden" name="productId" value={product.id} />
                    <input
                      type="hidden"
                      name="returnTo"
                      value={`${buildCostsHref({
                        editProductId: product.id,
                      })}#cost-product-${product.id}-${variant?.id ?? 'base'}`}
                    />

                    <label className="block text-sm font-medium">
                      Оплата за роботу за 1 сумку (грн)
                      <input
                        name="laborCostUAH"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={laborCostUAH}
                        className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="block text-sm font-medium">
                      Інші витрати на 1 шт (грн)
                      <input
                        name="otherCostUAH"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={otherCostUAH}
                        className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="block text-sm font-medium">
                      Доставка на 1 шт (грн)
                      <input
                        name="shippingCostUAH"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={shippingCostUAH}
                        className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="block text-sm font-medium md:col-span-2 xl:col-span-2">
                      Нотатки
                      <input
                        name="notes"
                        defaultValue={product.costProfile?.notes ?? ''}
                        placeholder="Коментар до ручних витрат"
                        className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </label>

                    <div className="md:col-span-2 xl:col-span-4">
                      <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
                        Зберегти збірку
                      </button>
                    </div>
                  </form>
                </div>
              </details>
            ),
          )
        )}
      </section>
    </div>
  )
}
