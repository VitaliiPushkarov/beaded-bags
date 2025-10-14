import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  const body = await req.json() // Fondy шле status, order_id, amount, signature...
  const { order_id, order_status } = body?.order ?? body // залежно від формату
  const status = order_status === 'approved' ? 'paid' : 'failed'
  await prisma.order.update({
    where: { id: String(order_id) },
    data: { status },
  })
  return NextResponse.json({ ok: true })
}
