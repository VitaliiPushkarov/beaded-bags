// Create order before payment
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

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
  phone: string
  email?: string
  cityName?: string
  warehouseRef?: string
  warehouseAddress?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      items: OrderItemInput[]
      amountUAH: number
      customer: CustomerInput
    }

    const { items, amountUAH, customer } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items' }, { status: 400 })
    }
    if (!customer?.name || !customer?.phone) {
      return NextResponse.json(
        { error: 'Customer name/phone required' },
        { status: 400 }
      )
    }
    if (typeof amountUAH !== 'number' || !Number.isFinite(amountUAH)) {
      return NextResponse.json({ error: 'Invalid amountUAH' }, { status: 400 })
    }

    const subtotalUAH = items.reduce(
      (sum, it) => sum + (Number(it.priceUAH) || 0) * (Number(it.qty) || 0),
      0
    )

    const order = await prisma.order.create({
      data: {
        status: 'PENDING',
        amountUAH,
        subtotalUAH,
        totalUAH: amountUAH,
        customerName: customer.name,
        customerPhone: customer.phone,
        // JSON fields
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
        customer,
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
