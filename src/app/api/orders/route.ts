// Create order before payment
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, PaymentMethod } from '@prisma/client'

const prisma = new PrismaClient()

// Types for request body
type OrderItemInput = {
  productId: string
  variantId?: string
  name: string
  priceUAH: number
  qty: number
  image?: string
  slug?: string
}

type CustomerInput = {
  name: string
  surname: string
  patronymic?: string
  phone: string
  email?: string
}

type ShippingInput = {
  npCityRef: string
  npCityName: string
  npWarehouseRef: string
  npWarehouseName: string
}

type BodyInput = {
  items: OrderItemInput[]
  subtotalUAH?: number // опційно: можемо перерахувати
  deliveryUAH?: number
  discountUAH?: number
  totalUAH: number
  customer: CustomerInput
  shipping: ShippingInput
  paymentMethod: PaymentMethod // 'LIQPAY' | 'COD' | 'BANK_TRANSFER'
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BodyInput

    const {
      items,
      subtotalUAH,
      deliveryUAH = 0,
      discountUAH = 0,
      totalUAH,
      customer,
      shipping,
      paymentMethod,
    } = body

    // --- валідація вхідних даних ---
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items' }, { status: 400 })
    }
    if (!customer?.name || !customer?.surname || !customer?.phone) {
      return NextResponse.json(
        { error: 'Customer name/surname/phone required' },
        { status: 400 }
      )
    }
    if (
      !shipping?.npCityRef ||
      !shipping?.npCityName ||
      !shipping?.npWarehouseRef ||
      !shipping?.npWarehouseName
    ) {
      return NextResponse.json(
        { error: 'Nova Poshta shipping fields are required' },
        { status: 400 }
      )
    }
    if (!paymentMethod) {
      return NextResponse.json(
        { error: 'paymentMethod is required' },
        { status: 400 }
      )
    }
    if (typeof totalUAH !== 'number' || !Number.isFinite(totalUAH)) {
      return NextResponse.json({ error: 'Invalid totalUAH' }, { status: 400 })
    }

    const computedSubtotal =
      subtotalUAH ??
      items.reduce(
        (sum, it) => sum + (Number(it.priceUAH) || 0) * (Number(it.qty) || 0),
        0
      )

    // --- створення замовлення ---
    const order = await prisma.order.create({
      data: {
        status: 'PENDING',
        // totals snapshot
        subtotalUAH: computedSubtotal,
        deliveryUAH,
        discountUAH,
        totalUAH,

        // customer snapshot
        customerName: customer.name,
        customerSurname: customer.surname,
        customerPatronymic: customer.patronymic ?? null,
        customerPhone: customer.phone,
        customerEmail: customer.email ?? null,

        // Nova Poshta snapshot
        npCityRef: shipping.npCityRef,
        npCityName: shipping.npCityName,
        npWarehouseRef: shipping.npWarehouseRef,
        npWarehouseName: shipping.npWarehouseName,

        // payment snapshot
        paymentMethod,

        // items
        items: {
          create: items.map((it) => ({
            productId: it.productId,
            variantId: it.variantId,
            name: it.name,
            priceUAH: it.priceUAH,
            qty: it.qty,
            image: it.image,
            slug: it.slug,
          })),
        },

        // пов'язаний клієнт (опційно)
        customer: customer.phone
          ? {
              connectOrCreate: {
                where: { phone: customer.phone },
                create: {
                  name: `${customer.name} ${customer.surname}`.trim(),
                  phone: customer.phone,
                  email: customer.email ?? null,
                },
              },
            }
          : undefined,
      },
    })

    return NextResponse.json(order)
  } catch (err) {
    console.error('Create order error:', err)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}
