import { OrderStatus, PaymentMethod } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { toDateInputValue } from '@/lib/admin-finance'
import { buildOrderFinancialSnapshot } from '@/lib/finance'
import { buildManagedUnitCostUAH } from '@/lib/management-accounting'
import { prisma } from '@/lib/prisma'
import OrdersTableClient from './OrdersTableClient'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<OrderStatus, string> = {
  FAILED: 'Не вдалося',
  PENDING: 'Очікує',
  PAID: 'Оплачено',
  CANCELLED: 'Скасовано',
  FULFILLED: 'Виконано',
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  LIQPAY: 'LiqPay',
  WAYFORPAY: 'WayForPay',
  COD: 'Післяплата / готівка',
  BANK_TRANSFER: 'Банківський переказ',
}

const ManualOrderSchema = z.object({
  orderDate: z.coerce.date(),
  source: z.string().trim().min(2).max(64),
  status: z.nativeEnum(OrderStatus),
  paymentMethod: z.nativeEnum(PaymentMethod),
  customerName: z.string().trim().min(2),
  customerSurname: z.string().trim().min(2),
  customerPatronymic: z.string().trim().optional(),
  customerPhone: z.string().trim().min(5),
  customerEmail: z.string().trim().email().optional().or(z.literal('')),
  npCityName: z.string().trim().optional(),
  npWarehouseName: z.string().trim().optional(),
  deliveryUAH: z.coerce.number().int().min(0).default(0),
  discountUAH: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().optional(),
  itemsRaw: z.string().trim().min(1),
})

type ProductLookup = {
  id: string
  slug: string
  name: string
  packagingTemplate: {
    costUAH: number
  } | null
  materialUsages: Array<{
    quantity: number
    material: {
      unitCostUAH: number
    }
  }>
  costProfile: {
    materialsCostUAH: number
    laborCostUAH: number
    packagingCostUAH: number
    shippingCostUAH: number
    otherCostUAH: number
  } | null
}

type ParsedManualItem = {
  name: string
  qty: number
  priceUAH: number
  productId: string | null
}

function parseLineNumber(raw: string): number {
  return Number(
    raw
      .replace(/\s+/g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, ''),
  )
}

function parseManualItems(
  input: string,
  productsBySlug: Map<string, ProductLookup>,
): ParsedManualItem[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split(';').map((part) => part.trim())
      if (parts.length < 3) {
        throw new Error(
          `Рядок ${index + 1} має бути у форматі: назва/slug; кількість; ціна; [slug]`,
        )
      }

      const titleOrSlug = parts[0]
      const qty = parseLineNumber(parts[1])
      const priceUAH = parseLineNumber(parts[2])
      const explicitSlug = parts[3]?.toLowerCase()

      if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
        throw new Error(`Некоректна кількість у рядку ${index + 1}`)
      }
      if (!Number.isFinite(priceUAH) || priceUAH < 0) {
        throw new Error(`Некоректна ціна у рядку ${index + 1}`)
      }

      const byExplicitSlug = explicitSlug
        ? productsBySlug.get(explicitSlug)
        : undefined
      const byFirstTokenSlug = productsBySlug.get(titleOrSlug.toLowerCase())
      const product = byExplicitSlug ?? byFirstTokenSlug

      return {
        name: product?.name ?? titleOrSlug,
        qty: Math.round(qty),
        priceUAH: Math.round(priceUAH),
        productId: product?.id ?? null,
      }
    })
}

export default async function AdminOrdersPage() {
  async function createManualOrder(formData: FormData) {
    'use server'

    const parsed = ManualOrderSchema.safeParse({
      orderDate: formData.get('orderDate'),
      source: formData.get('source'),
      status: formData.get('status'),
      paymentMethod: formData.get('paymentMethod'),
      customerName: formData.get('customerName'),
      customerSurname: formData.get('customerSurname'),
      customerPatronymic: formData.get('customerPatronymic'),
      customerPhone: formData.get('customerPhone'),
      customerEmail: formData.get('customerEmail'),
      npCityName: formData.get('npCityName'),
      npWarehouseName: formData.get('npWarehouseName'),
      deliveryUAH: formData.get('deliveryUAH'),
      discountUAH: formData.get('discountUAH'),
      notes: formData.get('notes'),
      itemsRaw: formData.get('itemsRaw'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося створити ручне замовлення')
    }

    const products = await prisma.product.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
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

    const productsBySlug = new Map(
      products.map((product) => [product.slug.toLowerCase(), product]),
    )
    const items = parseManualItems(parsed.data.itemsRaw, productsBySlug)

    const subtotalUAH = items.reduce((sum, item) => sum + item.priceUAH * item.qty, 0)
    const discountUAH = Math.min(parsed.data.discountUAH, subtotalUAH)
    const totalUAH = Math.max(
      0,
      subtotalUAH + parsed.data.deliveryUAH - discountUAH,
    )

    const costByProductId = new Map(
      products.map((product) => [
        product.id,
        buildManagedUnitCostUAH({
          profile: product.costProfile,
          materialUsages: product.materialUsages,
          packagingTemplateCostUAH: product.packagingTemplate?.costUAH,
          includeShipping: false,
        }),
      ]),
    )

    const financialSnapshot = buildOrderFinancialSnapshot({
      subtotalUAH,
      discountUAH,
      totalUAH,
      paymentMethod: parsed.data.paymentMethod,
      lines: items.map((item) => ({
        qty: item.qty,
        priceUAH: item.priceUAH,
        unitCostUAH: item.productId ? (costByProductId.get(item.productId) ?? 0) : 0,
      })),
    })

    const manualSource = parsed.data.source.trim()
    const npCityName = parsed.data.npCityName || 'Ручне замовлення'
    const npWarehouseName =
      parsed.data.npWarehouseName || `Джерело: ${manualSource}`

    await prisma.order.create({
      data: {
        createdAt: parsed.data.orderDate,
        status: parsed.data.status,
        subtotalUAH,
        deliveryUAH: parsed.data.deliveryUAH,
        discountUAH,
        totalUAH,
        itemsCostUAH: financialSnapshot.itemsCostUAH,
        paymentFeeUAH: financialSnapshot.paymentFeeUAH,
        grossProfitUAH: financialSnapshot.grossProfitUAH,
        customerName: parsed.data.customerName,
        customerSurname: parsed.data.customerSurname,
        customerPatronymic: parsed.data.customerPatronymic || null,
        customerPhone: parsed.data.customerPhone,
        customerEmail: parsed.data.customerEmail || null,
        npCityRef: `manual-${manualSource.toLowerCase().replace(/\s+/g, '-')}-city`,
        npCityName,
        npWarehouseRef: `manual-${manualSource.toLowerCase().replace(/\s+/g, '-')}-point`,
        npWarehouseName,
        paymentMethod: parsed.data.paymentMethod,
        paymentRaw: {
          manualOrder: true,
          source: manualSource,
          notes: parsed.data.notes || null,
        },
        customer: {
          connectOrCreate: {
            where: { phone: parsed.data.customerPhone },
            create: {
              name: `${parsed.data.customerName} ${parsed.data.customerSurname}`.trim(),
              phone: parsed.data.customerPhone,
              email: parsed.data.customerEmail || null,
            },
          },
        },
        items: {
          create: items.map((item, index) => ({
            productId: item.productId,
            variantId: null,
            name: item.name,
            color: null,
            image: null,
            priceUAH: item.priceUAH,
            qty: item.qty,
            discountUAH: financialSnapshot.lines[index]?.discountUAH ?? 0,
            lineRevenueUAH: financialSnapshot.lines[index]?.lineRevenueUAH ?? 0,
            unitCostUAH: financialSnapshot.lines[index]?.unitCostUAH ?? 0,
            totalCostUAH: financialSnapshot.lines[index]?.totalCostUAH ?? 0,
            strapName: null,
            addons: [],
          })),
        },
      },
    })

    revalidatePath('/admin/orders')
    revalidatePath('/admin/finance')
    revalidatePath('/admin')
  }

  let orders: Awaited<ReturnType<typeof prisma.order.findMany>> = []

  try {
    orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: true,
      },
    })
  } catch (e) {
    console.error('Failed to load orders for admin page:', e)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Замовлення</h1>
        <p className="text-sm text-gray-600">
          Створюйте ручні замовлення для месенджерів, ярмарків і офлайн-продажів.
        </p>
      </div>

      <section className="rounded border bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-medium">Додати ручне замовлення</h2>
        <form action={createManualOrder} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm font-medium">
            Дата замовлення
            <input
              name="orderDate"
              type="date"
              defaultValue={toDateInputValue(new Date())}
              required
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Джерело
            <select
              name="source"
              defaultValue="MESSENGER"
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="MESSENGER">Месенджер</option>
              <option value="FAIR">Ярмарок</option>
              <option value="SHOWROOM">Шоурум</option>
              <option value="OTHER">Інше</option>
            </select>
          </label>

          <label className="block text-sm font-medium">
            Статус
            <select
              name="status"
              defaultValue={OrderStatus.PAID}
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            >
              {[OrderStatus.PENDING, OrderStatus.PAID, OrderStatus.FULFILLED, OrderStatus.CANCELLED].map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Оплата
            <select
              name="paymentMethod"
              defaultValue={PaymentMethod.COD}
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            >
              {Object.values(PaymentMethod).map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Ім'я
            <input
              name="customerName"
              required
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Прізвище
            <input
              name="customerSurname"
              required
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            По батькові
            <input
              name="customerPatronymic"
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Телефон
            <input
              name="customerPhone"
              required
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Email
            <input
              name="customerEmail"
              type="email"
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Місто / локація
            <input
              name="npCityName"
              placeholder="Наприклад: Київ або Ярмарок Львів"
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Точка видачі
            <input
              name="npWarehouseName"
              placeholder="Наприклад: Самовивіз / ТЦ ..."
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Доставка, грн
            <input
              name="deliveryUAH"
              type="number"
              min="0"
              defaultValue="0"
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Знижка, грн
            <input
              name="discountUAH"
              type="number"
              min="0"
              defaultValue="0"
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium sm:col-span-2 xl:col-span-4">
            Позиції замовлення
            <textarea
              name="itemsRaw"
              required
              className="mt-2 min-h-36 w-full rounded-lg border px-3 py-2 text-sm font-mono"
              placeholder={[
                'Формат рядка: назва/slug; кількість; ціна; [slug]',
                'tote-bag; 1; 3600',
                'Сумка Truffle Tote; 1; 3600; tote-bag',
              ].join('\n')}
            />
            <div className="mt-2 text-xs text-gray-500">
              Якщо вказуєте `slug` (в 1-й або 4-й колонці), система підтягує товар і собівартість для COGS.
            </div>
          </label>

          <label className="block text-sm font-medium sm:col-span-2 xl:col-span-4">
            Нотатки
            <textarea
              name="notes"
              className="mt-2 min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <div className="sm:col-span-2 xl:col-span-4">
            <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
              Створити ручне замовлення
            </button>
          </div>
        </form>
      </section>

      {orders.length === 0 ? (
        <p className="text-sm text-gray-600">
          Поки немає замовлень або сталася помилка завантаження.
        </p>
      ) : (
        <OrdersTableClient orders={orders} />
      )}
    </div>
  )
}
