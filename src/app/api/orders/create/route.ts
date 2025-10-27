import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
// import { prisma } from '@/lib/prisma'

const OrderItem = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional().nullable(),
  name: z.string().min(1),
  qty: z.number().int().min(1),
  priceUAH: z.number().min(0),
  image: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
})

const OrderSchema = z.object({
  items: z.array(OrderItem).min(1),
  amountUAH: z.number().min(0),
  customer: z.object({
    name: z.string().min(2),
    phone: z.string().min(5), // за бажанням зробити regex під +380
    email: z.string().email().optional().nullable(),
  }),
  shipping: z.object({
    method: z.literal('nova_poshta'),
    np: z.object({
      cityRef: z.string().min(1),
      cityName: z.string().min(1),
      warehouseRef: z.string().min(1),
      warehouseText: z.string().min(1),
    }),
  }),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = OrderSchema.safeParse(body)
    if (!parsed.success) {
      // докладні повідомлення у відповідь:
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const order = parsed.data

    // (опційно) перевірка суми:
    const calc = order.items.reduce((s, it) => s + it.priceUAH * it.qty, 0)
    if (Math.round(calc) !== Math.round(order.amountUAH)) {
      return NextResponse.json(
        { error: { _errors: ['amountUAH mismatch'] } },
        { status: 400 }
      )
    }

    // const created = await prisma.order.create({ data: { ... } })
    // return NextResponse.json({ orderId: created.id })

    // Для тесту — повернемо фейковий orderId
    return NextResponse.json({ orderId: `test-${Date.now()}` })
  } catch (e: any) {
    console.error('create order error:', e?.message || e)
    return NextResponse.json({ error: 'create failed' }, { status: 500 })
  }
}
