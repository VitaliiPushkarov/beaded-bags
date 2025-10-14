import { NextRequest, NextResponse } from 'next/server'
export async function POST(req: NextRequest) {
  const { orderId } = await req.json()
  const url = `/success?orderId=${encodeURIComponent(orderId)}&mock=1`
  return NextResponse.json({ url })
}
