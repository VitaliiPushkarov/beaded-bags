import { readFiscalReceiptStatus, type FiscalReceiptState } from '@/lib/liqpay-fiscal-status'
import { refreshOrderFromLiqPayStatusApi } from '@/lib/liqpay-settlement'
import { sendLiqPayFiscalReceiptAlert } from '@/lib/order-telegram'
import { prisma } from '@/lib/prisma'

export type FiscalAuditRow = {
  orderId: string
  shortNumber: number
  createdAt: Date
  totalUAH: number
  promoCode: string | null
  state: FiscalReceiptState
  errorDescription: string | null
  ticketUrl: string | null
}

const DEFAULT_WINDOW_DAYS = 60

// Each refresh is a network round-trip to LiqPay with its own timeout, so an
// unbounded loop over every unfiscalized order would outlive the serverless
// function it runs in. Cap the batch and overlap a few at a time; anything left
// over is picked up by the next run.
const RECHECK_BATCH_LIMIT = 24
const RECHECK_CONCURRENCY = 4

async function mapWithConcurrency<T>(
  values: T[],
  limit: number,
  run: (value: T) => Promise<void>,
) {
  let cursor = 0

  async function worker() {
    while (cursor < values.length) {
      const value = values[cursor]
      cursor += 1
      if (value !== undefined) await run(value)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  )
}

async function loadPaidLiqPayOrders(windowDays: number) {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  return prisma.order.findMany({
    where: {
      paymentMethod: 'LIQPAY',
      status: 'PAID',
      createdAt: { gte: since },
    },
    orderBy: { shortNumber: 'desc' },
    select: {
      id: true,
      shortNumber: true,
      createdAt: true,
      totalUAH: true,
      promoCode: true,
      paymentRaw: true,
    },
  })
}

function toRow(order: {
  id: string
  shortNumber: number
  createdAt: Date
  totalUAH: number
  promoCode: string | null
  paymentRaw: unknown
}): FiscalAuditRow {
  const fiscal = readFiscalReceiptStatus(order.paymentRaw)

  return {
    orderId: order.id,
    shortNumber: order.shortNumber,
    createdAt: order.createdAt,
    totalUAH: order.totalUAH,
    promoCode: order.promoCode,
    state: fiscal.state,
    errorDescription: fiscal.errorDescription,
    ticketUrl: fiscal.ticketUrl,
  }
}

// What the shop currently believes about each paid card order, read straight out
// of the stored callback. Cheap, but only as fresh as the last callback — use
// recheckLiqPayFiscalStatuses to confirm anything that looks unfiscalized.
export async function loadLiqPayFiscalAudit(
  windowDays = DEFAULT_WINDOW_DAYS,
): Promise<FiscalAuditRow[]> {
  const orders = await loadPaidLiqPayOrders(windowDays)
  return orders.map(toRow)
}

export type FiscalRecheckResult = {
  checked: number
  fiscalized: number
  stillFailing: number
  rows: FiscalAuditRow[]
}

// Ask LiqPay for the current state of every paid order that does not already
// have a receipt, and store what comes back.
//
// This exists because the callback arrives before LiqPay has necessarily
// finished fiscalizing: an order can be recorded as "failure" and hold a valid
// receipt minutes later. Re-reading is the only way to tell a transient gap from
// a real one, so failures are alerted only after this pass, never off the raw
// callback.
export async function recheckLiqPayFiscalStatuses(args?: {
  windowDays?: number
  alert?: boolean
}): Promise<FiscalRecheckResult> {
  const orders = await loadPaidLiqPayOrders(args?.windowDays ?? DEFAULT_WINDOW_DAYS)
  const pending = orders
    .filter(
      (order) => readFiscalReceiptStatus(order.paymentRaw).state !== 'success',
    )
    .slice(0, RECHECK_BATCH_LIMIT)

  await mapWithConcurrency(pending, RECHECK_CONCURRENCY, async (order) => {
    try {
      await refreshOrderFromLiqPayStatusApi(order.id)
    } catch (error) {
      console.error(
        `LiqPay fiscal recheck failed for order #${order.shortNumber}:`,
        error,
      )
    }
  })

  const refreshed = await loadPaidLiqPayOrders(
    args?.windowDays ?? DEFAULT_WINDOW_DAYS,
  )
  const rows = refreshed.map(toRow)
  const stillFailing = rows.filter((row) => row.state !== 'success')

  // "Fiscalized" counts only orders this pass actually flipped, so it stays
  // truthful when the batch limit left some unchecked.
  const checkedIds = new Set(pending.map((order) => order.id))
  const flipped = rows.filter(
    (row) => checkedIds.has(row.orderId) && row.state === 'success',
  ).length

  // One message for the whole pass, not one per order. There is no "already
  // alerted" flag on Order, so a per-order message would repeat the same list on
  // every run; a summary stays useful however often this is called.
  if (args?.alert && stillFailing.length > 0) {
    await sendLiqPayFiscalReceiptAlert({
      orders: stillFailing.map((row) => ({
        shortNumber: row.shortNumber,
        totalUAH: row.totalUAH,
      })),
      errorDescription:
        stillFailing.find((row) => row.errorDescription)?.errorDescription ??
        null,
    })
  }

  return {
    checked: pending.length,
    fiscalized: flipped,
    stillFailing: stillFailing.length,
    rows,
  }
}
