import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

// те, що приходить з фронта
const OrderItem = z.object({
  productId: z.string().optional().nullable(),
  variantId: z.string().optional().nullable(),
  name: z.string().min(1),
  qty: z.number().int().min(1),
  priceUAH: z.number().min(0),
  image: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
})

const BodySchema = z.object({
  items: z.array(OrderItem).min(1),
  amountUAH: z.number().min(0),
  customer: z.object({
    name: z.string().min(2),
    surname: z.string().min(2),
    patronymic: z.string().optional().nullable(),
    phone: z.string().min(10),
    email: z.email().optional().nullable(),
  }),
  shipping: z.object({
    method: z.literal('nova_poshta'),
    np: z.object({
      cityRef: z.string().min(1),
      cityName: z.string().min(1),
      warehouseRef: z.string().min(1),
      warehouseName: z.string().min(1),
    }),
  }),
  // frontend може передати варіант оплати, але ми його зафіксуємо нижче
  paymentMethod: z.enum(['LIQPAY', 'COD', 'BANK_TRANSFER']).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = BodySchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data

    // перерахунок суми на бекенді
    const subtotal = data.items.reduce(
      (sum, item) => sum + item.priceUAH * item.qty,
      0
    )

    if (Math.round(subtotal) !== Math.round(data.amountUAH)) {
      return NextResponse.json(
        { error: { _errors: ['amountUAH mismatch'] } },
        { status: 400 }
      )
    }

    // поки доставка 0
    const deliveryUAH = 0
    const discountUAH = 0
    const totalUAH = subtotal + deliveryUAH - discountUAH

    // важливо: у схемі paymentMethod обов’язковий
    const paymentMethod = data.paymentMethod ?? 'LIQPAY'

    const created = await prisma.order.create({
      data: {
        status: 'PENDING',
        subtotalUAH: subtotal,
        deliveryUAH,
        discountUAH,
        totalUAH,

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

        items: {
          create: data.items.map((it) => ({
            productId: it.productId ?? null,
            variantId: it.variantId ?? null,
            name: it.name,
            color: it.color ?? null,
            image: it.image ?? null,
            priceUAH: it.priceUAH,
            qty: it.qty,
          })),
        },
      },
      include: {
        items: true,
      },
    })

    return NextResponse.json(
      { orderId: created.id, orderNumber: created.shortNumber },
      { status: 201 }
    )
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('Create order error:', err.message)
    } else {
      console.error('Create order error:', err)
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
