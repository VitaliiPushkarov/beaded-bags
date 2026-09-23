import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { processOrderEmailQueue } from '@/lib/order-email-queue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret)
    return NextResponse.json(
      { error: 'Scheduler is not configured' },
      { status: 503 },
    )
  const actual = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await processOrderEmailQueue()
    return NextResponse.json(result, { status: result.reason ? 503 : 200 })
  } catch {
    return NextResponse.json(
      { error: 'Email queue unavailable' },
      { status: 503 },
    )
  }
}
