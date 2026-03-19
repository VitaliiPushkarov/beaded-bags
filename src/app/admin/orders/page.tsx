import { OrderStatus, PaymentMethod } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import ManualOrderItemsPicker from '@/components/admin/ManualOrderItemsPicker'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { calcDiscountedPrice } from '@/lib/pricing'
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

const MANUAL_SOURCE_LABELS = {
  MESSENGER: 'Месенджер',
  FAIR: 'Ярмарок',
  SHOWROOM: 'Шоурум',
  OTHER: 'Інше',
} as const

const OptionalNonNegativeInt = z.preprocess(
  (value) => {
    if (value == null) return undefined
    if (typeof value === 'string' && value.trim() === '') return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  },
  z.number().int().min(0).optional(),
)

const ManualOrderSchema = z.object({
  customerName: z.string().trim().min(2),
  customerSurname: z.string().trim().min(2),
  manualItemsRaw: z.string().trim().min(1),
  orderDate: z.string().trim().optional(),
  source: z.string().trim().optional(),
  status: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.nativeEnum(OrderStatus).optional(),
  ),
  paymentMethod: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.nativeEnum(PaymentMethod).optional(),
  ),
  customerPhone: z.string().trim().optional(),
  discountUAH: OptionalNonNegativeInt,
})

const ManualItemsSchema = z
  .array(
    z.object({
      variantId: z.string().min(1),
      qty: z.coerce.number().int().min(1).max(999),
    }),
  )
  .min(1)

type ManualItem = z.infer<typeof ManualItemsSchema>[number]

export default async function AdminOrdersPage() {
  async function createManualOrder(formData: FormData) {
    'use server'

    const parsed = ManualOrderSchema.safeParse({
      customerName: formData.get('customerName'),
      customerSurname: formData.get('customerSurname'),
      manualItemsRaw: formData.get('manualItems'),
      orderDate: formData.get('orderDate'),
      source: formData.get('source'),
      status: formData.get('status'),
      paymentMethod: formData.get('paymentMethod'),
      customerPhone: formData.get('customerPhone'),
      discountUAH: formData.get('discountUAH'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося створити ручне замовлення')
    }

    let manualItemsParsed: ManualItem[]
    try {
      const decoded = JSON.parse(parsed.data.manualItemsRaw)
      const manualItems = ManualItemsSchema.safeParse(decoded)
      if (!manualItems.success) {
        throw new Error('Некоректний список позицій')
      }
      manualItemsParsed = manualItems.data
    } catch {
      throw new Error('Не вдалося зчитати позиції замовлення')
    }

    const groupedManualItems = Array.from(
      manualItemsParsed.reduce<Map<string, number>>((acc, item) => {
        const current = acc.get(item.variantId) ?? 0
        acc.set(item.variantId, current + item.qty)
        return acc
      }, new Map()),
    ).map(([variantId, qty]) => ({ variantId, qty }))

    const variantIds = groupedManualItems.map((item) => item.variantId)

    const variants = await prisma.productVariant.findMany({
      where: {
        id: {
          in: variantIds,
        },
      },
      select: {
        id: true,
        color: true,
        image: true,
        images: {
          orderBy: { sort: 'asc' },
          select: { url: true },
          take: 1,
        },
        priceUAH: true,
        discountPercent: true,
        discountUAH: true,
        product: {
          select: {
            id: true,
            name: true,
            basePriceUAH: true,
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
            costProfile: {
              select: {
                laborCostUAH: true,
                shippingCostUAH: true,
                otherCostUAH: true,
              },
            },
          },
        },
      },
    })

    const variantsById = new Map(variants.map((variant) => [variant.id, variant]))

    const items = groupedManualItems.map((entry) => {
      const variant = variantsById.get(entry.variantId)
      if (!variant) {
        throw new Error('Один з обраних варіантів вже не існує')
      }

      const { finalPriceUAH } = calcDiscountedPrice({
        basePriceUAH: variant.priceUAH ?? variant.product.basePriceUAH ?? 0,
        discountPercent: variant.discountPercent,
        discountUAH: variant.discountUAH,
      })

      const unitCostUAH = buildManagedUnitCostUAH({
        profile: variant.product.costProfile,
        materialUsages: variant.product.materialUsages,
        packagingTemplateCostUAH: variant.product.packagingTemplate?.costUAH,
        includeShipping: false,
        variantColor: variant.color,
      })

      return {
        variant,
        qty: entry.qty,
        priceUAH: finalPriceUAH,
        unitCostUAH,
      }
    })

    const subtotalUAH = items.reduce(
      (sum, item) => sum + item.priceUAH * item.qty,
      0,
    )
    const discountUAH = Math.min(parsed.data.discountUAH ?? 0, subtotalUAH)
    const totalUAH = Math.max(0, subtotalUAH - discountUAH)

    const financialSnapshot = buildOrderFinancialSnapshot({
      subtotalUAH,
      discountUAH,
      totalUAH,
      paymentMethod: parsed.data.paymentMethod ?? PaymentMethod.COD,
      lines: items.map((item) => ({
        qty: item.qty,
        priceUAH: item.priceUAH,
        unitCostUAH: item.unitCostUAH,
      })),
    })

    const customerPhone = parsed.data.customerPhone?.trim() || 'Не вказано'
    const sourceRaw = parsed.data.source?.trim() || ''
    const sourceLabel =
      MANUAL_SOURCE_LABELS[sourceRaw as keyof typeof MANUAL_SOURCE_LABELS] ??
      'Ручне замовлення'

    const createdAt = (() => {
      const raw = parsed.data.orderDate?.trim()
      if (!raw) return new Date()
      const value = new Date(`${raw}T12:00:00`)
      return Number.isNaN(value.getTime()) ? new Date() : value
    })()

    const customerRelation = parsed.data.customerPhone?.trim()
      ? {
          customer: {
            connectOrCreate: {
              where: { phone: parsed.data.customerPhone.trim() },
              create: {
                name: `${parsed.data.customerName} ${parsed.data.customerSurname}`.trim(),
                phone: parsed.data.customerPhone.trim(),
                email: null,
              },
            },
          },
        }
      : {}

    await prisma.order.create({
      data: {
        createdAt,
        status: parsed.data.status ?? OrderStatus.PENDING,
        subtotalUAH,
        deliveryUAH: 0,
        discountUAH,
        totalUAH,
        itemsCostUAH: financialSnapshot.itemsCostUAH,
        paymentFeeUAH: financialSnapshot.paymentFeeUAH,
        grossProfitUAH: financialSnapshot.grossProfitUAH,
        customerName: parsed.data.customerName,
        customerSurname: parsed.data.customerSurname,
        customerPatronymic: null,
        customerPhone,
        customerEmail: null,
        npCityRef: 'manual-city',
        npCityName: 'Ручне замовлення',
        npWarehouseRef: 'manual-point',
        npWarehouseName: 'Не вказано',
        paymentMethod: parsed.data.paymentMethod ?? PaymentMethod.COD,
        paymentRaw: {
          manualOrder: true,
          source: sourceLabel,
          lines: items.map((item) => ({
            variantId: item.variant.id,
            qty: item.qty,
            unitPriceUAH: item.priceUAH,
          })),
        },
        ...customerRelation,
        items: {
          create: items.map((item, index) => ({
            productId: item.variant.product.id,
            variantId: item.variant.id,
            name: item.variant.color
              ? `${item.variant.product.name} — ${item.variant.color}`
              : item.variant.product.name,
            color: item.variant.color,
            image: item.variant.images[0]?.url ?? item.variant.image,
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

  const [variantRows, orders] = await Promise.all([
    prisma.productVariant.findMany({
      orderBy: [
        { product: { sortCatalog: 'asc' } },
        { sortCatalog: 'asc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        color: true,
        image: true,
        images: {
          orderBy: { sort: 'asc' },
          select: { url: true },
          take: 1,
        },
        priceUAH: true,
        discountPercent: true,
        discountUAH: true,
        product: {
          select: {
            name: true,
            basePriceUAH: true,
          },
        },
      },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: true,
      },
    }),
  ])

  const variantOptions = variantRows.map((variant) => {
    const { finalPriceUAH } = calcDiscountedPrice({
      basePriceUAH: variant.priceUAH ?? variant.product.basePriceUAH ?? 0,
      discountPercent: variant.discountPercent,
      discountUAH: variant.discountUAH,
    })

    return {
      id: variant.id,
      productName: variant.product.name,
      color: variant.color,
      imageUrl: variant.images[0]?.url ?? variant.image,
      priceUAH: finalPriceUAH,
    }
  })

  const manualOrderPickerResetKey = String(Date.now())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Замовлення</h1>
        <p className="text-sm text-gray-600">
          Створюйте ручні замовлення для месенджерів, ярмарків і офлайн-продажів.
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-200 bg-slate-50">
          <CardTitle>Додати ручне замовлення</CardTitle>
          <CardDescription>
            Обов&apos;язкові поля: Товари у замовленні, Ім&apos;я, Прізвище.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <form action={createManualOrder} className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Інформація про замовлення
              </h3>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="order-date">Дата</Label>
                  <Input
                    id="order-date"
                    name="orderDate"
                    type="date"
                    defaultValue={toDateInputValue(new Date())}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="order-source">Джерело</Label>
                  <Select id="order-source" name="source" defaultValue="">
                    <option value="">Не вказано</option>
                    {Object.entries(MANUAL_SOURCE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="order-status">Статус</Label>
                  <Select id="order-status" name="status" defaultValue="">
                    <option value="">За замовчуванням (Очікує)</option>
                    {[
                      OrderStatus.PENDING,
                      OrderStatus.PAID,
                      OrderStatus.FULFILLED,
                      OrderStatus.CANCELLED,
                    ].map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="order-payment">Оплата</Label>
                  <Select id="order-payment" name="paymentMethod" defaultValue="">
                    <option value="">За замовчуванням (Післяплата / готівка)</option>
                    {Object.values(PaymentMethod).map((method) => (
                      <option key={method} value={method}>
                        {PAYMENT_METHOD_LABELS[method]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="order-customer-name">Ім&apos;я *</Label>
                  <Input id="order-customer-name" name="customerName" required />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="order-customer-surname">Прізвище *</Label>
                  <Input
                    id="order-customer-surname"
                    name="customerSurname"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="order-customer-phone">Телефон</Label>
                  <Input id="order-customer-phone" name="customerPhone" />
                </div>
              </div>
            </div>

            <ManualOrderItemsPicker
              key={manualOrderPickerResetKey}
              options={variantOptions}
            />
          </form>
        </CardContent>
      </Card>

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
