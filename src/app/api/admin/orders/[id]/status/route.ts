import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { OrderStatus } from '@prisma/client'

const BodySchema = z.object({
  status: z.custom<OrderStatus>(),
})

type PageProps = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: PageProps) {
  try {
    const { id } = await params
    const json = await req.json()
    const parsed = BodySchema.safeParse(json)

    if (!parsed.success) {
      const formatted = parsed.error.format()
      return NextResponse.json({ error: formatted }, { status: 400 })
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status: parsed.data.status },
    })

    return NextResponse.json({ id: updated.id, status: updated.status })
  } catch (err) {
    console.error('Update order status error', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
