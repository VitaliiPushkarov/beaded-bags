// Create order before payment

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  const { items, amountUAH, customer } = await req.json()
  const order = await prisma.order.create({
    data: { items, amountUAH, customer, status: 'pending' },
  })
  return NextResponse.json(order)
}
