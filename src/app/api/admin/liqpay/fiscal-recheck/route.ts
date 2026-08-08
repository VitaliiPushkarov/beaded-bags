import { NextRequest, NextResponse } from 'next/server'

import { isAdminRequest } from '@/lib/admin-auth'
import { recheckLiqPayFiscalStatuses } from '@/lib/liqpay-fiscal-audit'

export const runtime = 'nodejs'

// Re-asks LiqPay whether each paid card order actually produced a ПРРО receipt,
// and reports the ones that still have none.
//
// The same work is available as a button on /admin/liqpay; this endpoint exists
// so it can also run unattended (a Vercel cron, or any scheduler) with
// CRON_SECRET, because an unfiscalized sale is only useful to know about while
// it can still be corrected. Unlike the admin button, this path alerts on
// Telegram — nobody is watching a screen when it runs.
async function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()

  if (secret) {
    const header = req.headers.get('authorization')?.trim()
    if (header === `Bearer ${secret}`) return true
  }

  return isAdminRequest(req)
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await recheckLiqPayFiscalStatuses({ alert: true })

    return NextResponse.json({
      checked: result.checked,
      fiscalized: result.fiscalized,
      stillFailing: result.stillFailing,
      orders: result.rows
        .filter((row) => row.state !== 'success')
        .map((row) => ({
          shortNumber: row.shortNumber,
          totalUAH: row.totalUAH,
          state: row.state,
          errorDescription: row.errorDescription,
        })),
    })
  } catch (error) {
    console.error('[liqpay:fiscal] recheck endpoint failed', error)
    return NextResponse.json({ error: 'recheck failed' }, { status: 500 })
  }
}
