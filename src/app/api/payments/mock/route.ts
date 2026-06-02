import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  const { orderId } = await req.json()
  const url = `/success?orderId=${encodeURIComponent(orderId)}&mock=1`
  return NextResponse.json({ url })
}
