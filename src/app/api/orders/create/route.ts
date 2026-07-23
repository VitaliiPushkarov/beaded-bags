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
import { resolveCheckoutPaymentMethod } from '@/lib/orders/payment-methods'
import { sendOrderTelegramNotification } from '@/lib/order-telegram'
import {
  isOutOfStockStatus,
  resolveAvailabilityStatus,
} from '@/lib/availability'

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

    const paymentMethod = resolveCheckoutPaymentMethod(
      data.paymentMethod,
      data.shipping.method,
    )
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
            inStock: true,
            availabilityStatus: true,
            product: {
              select: {
                id: true,
                status: true,
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
    // Re-validate availability on the server. The cart is persisted in the
    // browser (localStorage), so it can reference variants that have since sold
    // out, been archived, or been deleted between adding to cart and checkout.
    // Pricing is already re-checked above; here we ensure every line is still
    // purchasable. IN_STOCK and PREORDER are both valid purchase paths — only
    // OUT_OF_STOCK / archived / removed variants are rejected.
    if (variantIds.length) {
      const variantById = new Map(variants.map((variant) => [variant.id, variant]))
      const unavailableItems: string[] = []

      for (const item of data.items) {
        if (!item.variantId) continue
        const variant = variantById.get(item.variantId)

        if (!variant || variant.product.status === 'ARCHIVED') {
          unavailableItems.push(item.name)
          continue
        }

        const status = resolveAvailabilityStatus({
          availabilityStatus: variant.availabilityStatus,
          inStock: variant.inStock,
        })
        if (isOutOfStockStatus(status)) {
          unavailableItems.push(item.name)
        }
      }

      if (unavailableItems.length) {
        return NextResponse.json(
          {
            error: {
              code: 'ITEMS_UNAVAILABLE',
              items: unavailableItems,
              _errors: ['Some items are no longer available'],
            },
          },
          { status: 409 },
        )
      }
    }

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

    const shippingCreateData =
      data.shipping.method === 'nova_poshta'
        ? {
            shippingMethod: 'NOVA_POSHTA' as const,
            shippingCountryCode: 'UA',
            shippingCountryName: 'Ukraine',
            shippingRegion: null,
            shippingCity: data.shipping.np.cityName,
            shippingPostalCode: null,
            shippingAddressLine1: data.shipping.np.warehouseName,
            shippingAddressLine2: null,
            npCityRef: data.shipping.np.cityRef,
            npCityName: data.shipping.np.cityName,
            npWarehouseRef: data.shipping.np.warehouseRef,
            npWarehouseName: data.shipping.np.warehouseName,
          }
        : {
            shippingMethod: 'INTERNATIONAL_ADDRESS' as const,
            shippingCountryCode: data.shipping.address.countryCode.toUpperCase(),
            shippingCountryName: data.shipping.address.countryName,
            shippingRegion: data.shipping.address.region ?? null,
            shippingCity: data.shipping.address.city,
            shippingPostalCode: data.shipping.address.postalCode,
            shippingAddressLine1: data.shipping.address.addressLine1,
            shippingAddressLine2: data.shipping.address.addressLine2 ?? null,
            npCityRef: null,
            npCityName: null,
            npWarehouseRef: null,
            npWarehouseName: null,
          }

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
          ...shippingCreateData,

          paymentMethod,
          paymentId: null,
          paymentStatus: null,
          checkoutSessionKey: idempotencyKey,

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
