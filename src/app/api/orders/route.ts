import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PaymentMethod } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { buildOrderFinancialSnapshot } from '@/lib/finance'
import { buildManagedUnitCostUAH } from '@/lib/management-accounting'

const BodySchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().optional().nullable(),
        name: z.string().min(1),
        priceUAH: z.number().min(0),
        qty: z.number().int().min(1),
        image: z.string().optional().nullable(),
      }),
    )
    .min(1),
  subtotalUAH: z.number().optional(),
  deliveryUAH: z.number().min(0).optional().default(0),
  discountUAH: z.number().min(0).optional().default(0),
  totalUAH: z.number().min(0),
  customer: z.object({
    name: z.string().min(1),
    surname: z.string().min(1),
    patronymic: z.string().optional().nullable(),
    phone: z.string().min(5),
    email: z.string().email().optional().nullable(),
  }),
  shipping: z.object({
    npCityRef: z.string().min(1),
    npCityName: z.string().min(1),
    npWarehouseRef: z.string().min(1),
    npWarehouseName: z.string().min(1),
  }),
  paymentMethod: z.nativeEnum(PaymentMethod),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await req.json())

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const data = parsed.data
    const subtotalUAH =
      data.subtotalUAH ??
      data.items.reduce((sum, item) => sum + item.priceUAH * item.qty, 0)

    const productIds = Array.from(new Set(data.items.map((item) => item.productId)))
    const products = await prisma.product.findMany({
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
      discountUAH: data.discountUAH,
      totalUAH: data.totalUAH,
      paymentMethod: data.paymentMethod,
      lines: data.items.map((item) => ({
        qty: item.qty,
        priceUAH: item.priceUAH,
        unitCostUAH: costByProductId.get(item.productId) ?? 0,
      })),
    })

    const order = await prisma.order.create({
      data: {
        status: 'PENDING',
        subtotalUAH,
        deliveryUAH: data.deliveryUAH,
        discountUAH: data.discountUAH,
        totalUAH: data.totalUAH,
        itemsCostUAH: financialSnapshot.itemsCostUAH,
        paymentFeeUAH: financialSnapshot.paymentFeeUAH,
        grossProfitUAH: financialSnapshot.grossProfitUAH,
        customerName: data.customer.name,
        customerSurname: data.customer.surname,
        customerPatronymic: data.customer.patronymic ?? null,
        customerPhone: data.customer.phone,
        customerEmail: data.customer.email ?? null,
        npCityRef: data.shipping.npCityRef,
        npCityName: data.shipping.npCityName,
        npWarehouseRef: data.shipping.npWarehouseRef,
        npWarehouseName: data.shipping.npWarehouseName,
        paymentMethod: data.paymentMethod,
        customer: {
          connectOrCreate: {
            where: { phone: data.customer.phone },
            create: {
              name: `${data.customer.name} ${data.customer.surname}`.trim(),
              phone: data.customer.phone,
              email: data.customer.email ?? null,
            },
          },
        },
        items: {
          create: data.items.map((item, index) => ({
            productId: item.productId,
            variantId: item.variantId ?? null,
            name: item.name,
            image: item.image ?? null,
            priceUAH: item.priceUAH,
            qty: item.qty,
            discountUAH: financialSnapshot.lines[index]?.discountUAH ?? 0,
            lineRevenueUAH: financialSnapshot.lines[index]?.lineRevenueUAH ?? 0,
            unitCostUAH: financialSnapshot.lines[index]?.unitCostUAH ?? 0,
            totalCostUAH: financialSnapshot.lines[index]?.totalCostUAH ?? 0,
          })),
        },
      },
    })

    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    console.error('Create order error:', err)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 },
    )
  }
}
