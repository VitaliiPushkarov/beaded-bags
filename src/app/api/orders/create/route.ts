import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { buildOrderFinancialSnapshot } from '@/lib/finance'
import {
  buildManagedUnitCostUAH,
  getAverageLaborCostByVariantId,
} from '@/lib/management-accounting'
import { calcDiscountUAH, resolvePromoCode } from '@/lib/promo'
import { OrderCreateCheckoutBodySchema } from '@/lib/orders/create-order-schema'
import { sendOrderTelegramNotification } from '@/lib/order-telegram'

function normalizeIdempotencyKey(value: string | undefined): string | null {
  const trimmed = String(value ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = OrderCreateCheckoutBodySchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const data = parsed.data

    // перерахунок суми на бекенді
    const subtotal = data.items.reduce(
      (sum, item) => sum + item.priceUAH * item.qty,
      0,
    )

    // поки доставка 0
    const deliveryUAH = 0
    const appliedPromoCode = resolvePromoCode(data.promoCode)
    const discountUAH = calcDiscountUAH(subtotal, appliedPromoCode)
    const totalUAH = Math.max(0, subtotal + deliveryUAH - discountUAH)

    if (Math.round(totalUAH) !== Math.round(data.amountUAH)) {
      return NextResponse.json(
        { error: { _errors: ['amountUAH mismatch'] } },
        { status: 400 },
      )
    }

    // важливо: у схемі paymentMethod обов’язковий
    const paymentMethod = data.paymentMethod ?? 'LIQPAY'
    const idempotencyKey = normalizeIdempotencyKey(data.idempotencyKey)

    if (idempotencyKey) {
      const existing = await prisma.order.findUnique({
        where: { checkoutSessionKey: idempotencyKey },
        select: { id: true, shortNumber: true },
      })

      if (existing) {
        return NextResponse.json(
          {
            orderId: existing.id,
            orderNumber: existing.shortNumber,
            reused: true,
          },
          { status: 200 },
        )
      }
    }

    const productIds = Array.from(
      new Set(
        data.items
          .map((item) => item.productId ?? null)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    )

    const products = productIds.length
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
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
        })
      : []

    const variantIds = Array.from(
      new Set(
        data.items
          .map((item) => item.variantId ?? null)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    )

    const variants = variantIds.length
      ? await prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            color: true,
            product: {
              select: {
                id: true,
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
      : []
    const averageLaborCostByVariantId = await getAverageLaborCostByVariantId(
      prisma,
      variantIds,
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

    const costByVariantId = new Map(
      variants.map((variant) => [
        variant.id,
        buildManagedUnitCostUAH({
          profile: variant.product.costProfile,
          laborCostUAHOverride: averageLaborCostByVariantId.get(variant.id),
          materialUsages: variant.product.materialUsages,
          packagingTemplateCostUAH: variant.product.packagingTemplate?.costUAH,
          includeShipping: false,
          variantColor: variant.color,
        }),
      ]),
    )

    const financialSnapshot = buildOrderFinancialSnapshot({
      subtotalUAH: subtotal,
      discountUAH,
      totalUAH,
      paymentMethod,
      lines: data.items.map((item) => ({
        qty: item.qty,
        priceUAH: item.priceUAH,
        unitCostUAH:
          (item.variantId ? costByVariantId.get(item.variantId) : undefined) ??
          (item.productId ? (costByProductId.get(item.productId) ?? 0) : 0),
      })),
    })

    let created
    try {
      created = await prisma.order.create({
        data: {
          status: 'PENDING',
          subtotalUAH: subtotal,
          deliveryUAH,
          discountUAH,
          totalUAH,
          itemsCostUAH: financialSnapshot.itemsCostUAH,
          paymentFeeUAH: financialSnapshot.paymentFeeUAH,
          grossProfitUAH: financialSnapshot.grossProfitUAH,

          customerName: data.customer.name,
          customerSurname: data.customer.surname,
          customerPatronymic: data.customer.patronymic ?? null,
          customerPhone: data.customer.phone,
          customerEmail: data.customer.email ?? null,

          npCityRef: data.shipping.np.cityRef,
          npCityName: data.shipping.np.cityName,
          npWarehouseRef: data.shipping.np.warehouseRef,
          npWarehouseName: data.shipping.np.warehouseName,

          paymentMethod,
          paymentId: null,
          paymentStatus: null,
          checkoutSessionKey: idempotencyKey,

          customer: data.customer.phone
            ? {
                connectOrCreate: {
                  where: { phone: data.customer.phone },
                  create: {
                    name: `${data.customer.name} ${data.customer.surname}`.trim(),
                    phone: data.customer.phone,
                    email: data.customer.email ?? null,
                  },
                },
              }
            : undefined,

          items: {
            create: data.items.map((it, index) => ({
              productId: it.productId ?? null,
              variantId: it.variantId ?? null,
              strapId: it.strapId ?? null,
              sizeId: it.sizeId ?? null,
              pouchId: it.pouchId ?? null,
              name: it.name,
              color: it.color ?? null,
              modelSize: it.modelSize ?? null,
              pouchColor: it.pouchColor ?? null,
              image: it.image ?? null,
              priceUAH: it.priceUAH,
              qty: it.qty,
              discountUAH: financialSnapshot.lines[index]?.discountUAH ?? 0,
              lineRevenueUAH: financialSnapshot.lines[index]?.lineRevenueUAH ?? 0,
              unitCostUAH: financialSnapshot.lines[index]?.unitCostUAH ?? 0,
              totalCostUAH: financialSnapshot.lines[index]?.totalCostUAH ?? 0,
              strapName: it.strapName ?? null,
              addons: it.addons ?? [],
            })),
          },
        },
        include: {
          items: true,
        },
      })
    } catch (error: unknown) {
      if (
        idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await prisma.order.findUnique({
          where: { checkoutSessionKey: idempotencyKey },
          select: { id: true, shortNumber: true },
        })

        if (existing) {
          return NextResponse.json(
            {
              orderId: existing.id,
              orderNumber: existing.shortNumber,
              reused: true,
            },
            { status: 200 },
          )
        }
      }

      throw error
    }

    if (created.paymentMethod !== 'LIQPAY') {
      try {
        await sendOrderTelegramNotification(created.id)
      } catch (e) {
        console.error(
          'Telegram: failed to send order notification (non-blocking):',
          e,
        )
      }
    }

    return NextResponse.json(
      { orderId: created.id, orderNumber: created.shortNumber },
      { status: 201 },
    )
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('Create order error:', err.message)
    } else {
      console.error('Create order error:', err)
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}
