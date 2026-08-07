import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { buildOrderFinancialSnapshot } from '@/lib/finance'
import {
  buildManagedUnitCostUAH,
  getAverageLaborCostByVariantId,
} from '@/lib/management-accounting'
import { recordPromoRedemption, resolvePromoCode } from '@/lib/promo-server'
import { OrderCreateCheckoutBodySchema } from '@/lib/orders/create-order-schema'
import {
  repriceOrderLines,
  type RepriceCatalogVariant,
} from '@/lib/orders/reprice'
import {
  resolveCheckoutPaymentMethod,
  resolveInstallmentPaytype,
} from '@/lib/orders/payment-methods'
import { sendOrderCustomerEmailSafe } from '@/lib/order-email'
import { sendOrderTelegramNotification } from '@/lib/order-telegram'
import {
  isOutOfStockStatus,
  resolveAvailabilityStatus,
} from '@/lib/availability'

function normalizeIdempotencyKey(value: string | undefined): string | null {
  const trimmed = String(value ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

type PricedVariantRow = {
  id: string
  priceUAH: number | null
  discountPercent: number | null
  discountUAH: number | null
  product: { basePriceUAH: number | null }
  straps: Array<{ id: string; extraPriceUAH: number }>
  sizes: Array<{ id: string; extraPriceUAH: number }>
  pouches: Array<{
    id: string
    extraPriceUAH: number
    straps: Array<{ id: string }>
  }>
}

// Option surcharges are keyed per variant, so an option id from a different
// variant simply will not resolve and the line is refused.
function buildRepriceCatalog(
  variants: PricedVariantRow[],
): Map<string, RepriceCatalogVariant> {
  return new Map(
    variants.map((variant) => [
      variant.id,
      {
        id: variant.id,
        priceUAH: variant.priceUAH,
        discountPercent: variant.discountPercent,
        discountUAH: variant.discountUAH,
        productBasePriceUAH: variant.product.basePriceUAH,
        strapExtraById: new Map(
          variant.straps.map((strap) => [strap.id, strap.extraPriceUAH]),
        ),
        sizeExtraById: new Map(
          variant.sizes.map((size) => [size.id, size.extraPriceUAH]),
        ),
        pouchExtraById: new Map(
          variant.pouches.map((pouch) => [pouch.id, pouch.extraPriceUAH]),
        ),
        pouchIdByPouchStrapId: new Map(
          variant.pouches.flatMap((pouch) =>
            pouch.straps.map((strap) => [strap.id, pouch.id] as const),
          ),
        ),
      },
    ]),
  )
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

    const paymentMethod = resolveCheckoutPaymentMethod(
      data.paymentMethod,
      data.shipping.method,
    )
    const installmentPaytype = resolveInstallmentPaytype(
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
            // Pricing inputs — the order total is recomputed from these rather
            // than trusted from the cart.
            priceUAH: true,
            discountPercent: true,
            discountUAH: true,
            straps: { select: { id: true, extraPriceUAH: true } },
            sizes: { select: { id: true, extraPriceUAH: true } },
            pouches: {
              select: {
                id: true,
                extraPriceUAH: true,
                straps: { select: { id: true } },
              },
            },
            product: {
              select: {
                id: true,
                status: true,
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
      : []
    // Re-validate availability on the server. The cart is persisted in the
    // browser (localStorage), so it can reference variants that have since sold
    // out, been archived, or been deleted between adding to cart and checkout.
    // IN_STOCK and PREORDER are both valid purchase paths — only OUT_OF_STOCK /
    // archived / removed variants are rejected. Pricing is re-checked below.
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

    // Recompute every line from the catalogue. The cart is client-side, so its
    // prices are both forgeable and liable to be months out of date. Only the
    // chosen ids and quantities are taken from the request; the money is ours.
    const repriced = repriceOrderLines(
      data.items.map((item) => ({
        name: item.name,
        variantId: item.variantId,
        strapId: item.strapId,
        pouchStrapId: item.pouchStrapId,
        sizeId: item.sizeId,
        pouchId: item.pouchId,
        qty: item.qty,
        priceUAH: item.priceUAH,
      })),
      buildRepriceCatalog(variants),
    )

    if (repriced.issues.length) {
      console.warn(
        'Order rejected by repricing:',
        JSON.stringify(repriced.issues),
      )

      // A line referencing a variant or option that no longer exists cannot be
      // bought at all — that is the same situation as an out-of-stock item.
      const unbuyable = repriced.issues.filter(
        (issue) => issue.code !== 'PRICE_CHANGED',
      )

      if (unbuyable.length) {
        return NextResponse.json(
          {
            error: {
              code: 'ITEMS_UNAVAILABLE',
              items: unbuyable.map((issue) => issue.name),
              _errors: ['Some items are no longer available'],
            },
          },
          { status: 409 },
        )
      }

      // Pure price drift. Never silently charge a total the shopper did not
      // agree to — but do hand back the current prices, keyed by the position
      // in the submitted cart, so the checkout can correct itself and ask for
      // confirmation instead of dead-ending on a cart that still shows the
      // stale number.
      return NextResponse.json(
        {
          error: {
            code: 'PRICE_CHANGED',
            items: repriced.issues.map((issue) => issue.name),
            lines: repriced.issues.flatMap((issue) =>
              issue.code === 'PRICE_CHANGED'
                ? [
                    {
                      index: issue.index,
                      name: issue.name,
                      priceUAH: issue.actualUAH,
                    },
                  ]
                : [],
            ),
            _errors: ['Cart pricing is out of date'],
          },
        },
        { status: 409 },
      )
    }

    const subtotal = repriced.subtotalUAH
    // Доставка поки 0 — Нова пошта оплачується отримувачем.
    const deliveryUAH = 0
    // Promo rules are enforced here against the repriced subtotal, so an
    // expired, exhausted or below-minimum code cannot be forced through by the
    // client. An invalid code is not an error: the order proceeds at full
    // price, and the amount check below tells the shopper the total changed.
    const promoEvaluation = await resolvePromoCode(data.promoCode, subtotal)
    const appliedPromoCode = promoEvaluation.ok ? promoEvaluation.code : null
    const discountUAH = promoEvaluation.ok ? promoEvaluation.discountUAH : 0
    const totalUAH = Math.max(0, subtotal + deliveryUAH - discountUAH)

    // The client tells us what it displayed; if that disagrees with the server
    // total the shopper was shown a different number than we would charge.
    if (Math.round(totalUAH) !== Math.round(data.amountUAH)) {
      console.warn(
        `Order rejected: amount mismatch (client ${Math.round(data.amountUAH)} vs server ${totalUAH})`,
      )

      return NextResponse.json(
        {
          error: {
            code: 'PRICE_CHANGED',
            items: [],
            _errors: ['amountUAH mismatch'],
          },
        },
        { status: 409 },
      )
    }

    const unitPriceByItemIndex = new Map(
      repriced.lines.map((line) => [line.index, line.unitPriceUAH]),
    )

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
      lines: data.items.map((item, index) => ({
        qty: item.qty,
        priceUAH: unitPriceByItemIndex.get(index) ?? 0,
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
      created = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
        data: {
          status: 'PENDING',
          subtotalUAH: subtotal,
          deliveryUAH,
          discountUAH,
          totalUAH,
          promoCode: appliedPromoCode,
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
          // Carry the installment intent so the LiqPay create step can request
          // the "paypart" paytype. Consumed before payment; the callback later
          // overwrites paymentRaw with LiqPay's response.
          paymentRaw: installmentPaytype
            ? { installments: installmentPaytype }
            : undefined,
          checkoutSessionKey: idempotencyKey,

          items: {
            create: data.items.map((it, index) => ({
              productId: it.productId ?? null,
              variantId: it.variantId ?? null,
              strapId: it.strapId ?? null,
              pouchStrapId: it.pouchStrapId ?? null,
              sizeId: it.sizeId ?? null,
              pouchId: it.pouchId ?? null,
              name: it.name,
              color: it.color ?? null,
              modelSize: it.modelSize ?? null,
              pouchColor: it.pouchColor ?? null,
              image: it.image ?? null,
              // Server price, not the one the browser submitted.
              priceUAH: unitPriceByItemIndex.get(index) ?? 0,
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

        // Counted in the same transaction as the order, so the redemption
        // tally can never drift from the orders that actually used the code.
        if (appliedPromoCode) {
          await recordPromoRedemption(tx, appliedPromoCode)
        }

        return order
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

      // Bank transfer: checkout promises the customer we will send payment
      // details, so this email is what makes good on that promise. LiqPay
      // orders are confirmed from the payment callback instead, once the money
      // has actually arrived.
      await sendOrderCustomerEmailSafe({
        orderId: created.id,
        kind: 'AWAITING_PAYMENT',
      })
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
