import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  const { orderId } = await req.json()
  if (!orderId)
    return NextResponse.json(
      { ok: false, error: 'orderId required' },
      { status: 400 }
    )
  await prisma.order.update({
    where: { id: String(orderId) },
    data: { status: 'paid' },
  })
  return NextResponse.json({ ok: true })
}
