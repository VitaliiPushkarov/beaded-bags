export type LiqPayStatusPayload = {
  status?: unknown
  err_code?: unknown
  err_description?: unknown
  result?: unknown
  amount?: unknown
  currency?: unknown
  [key: string]: unknown
}

export type MappedOrderStatus = 'PAID' | 'FAILED' | 'CANCELLED' | null

const PAID_STATUSES = new Set([
  'success',
  'sandbox',
  'wait_accept',
  'wait_compensation',
])

function toLower(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function hasTransactionId(payload: LiqPayStatusPayload): boolean {
  return toLower(payload.transaction_id).length > 0
}

function isCancellationSignal(payload: LiqPayStatusPayload): boolean {
  const status = toLower(payload.status)
  if (status === 'cancel' || status === 'cancelled' || status === 'canceled') {
    return true
  }

  const errCode = toLower(payload.err_code)
  const text = `${toLower(payload.err_description)} ${toLower(payload.result)}`

  if (
    errCode.includes('cancel') ||
    errCode.includes('canceled') ||
    errCode.includes('cancelled')
  ) {
    return true
  }

  if (text.includes('cancel') || text.includes('скас')) {
    return true
  }

  return false
}

export type LiqPayAmountCheck =
  | { status: 'ok' }
  | { status: 'unverifiable'; reason: string }
  | {
      status: 'mismatch'
      paidAmountUAH: number
      paidCurrency: string
      expectedUAH: number
    }

// A valid signature proves LiqPay sent the callback; it does not prove the
// amount charged is the amount we asked for. Verify that separately before an
// order is treated as paid.
//
// When the payload carries no amount at all we cannot check it — that is
// reported as unverifiable rather than as a mismatch, so a missing optional
// field never blocks a genuine payment.
export function verifyLiqPayPaidAmount(
  payload: LiqPayStatusPayload,
  expectedTotalUAH: number,
): LiqPayAmountCheck {
  const rawAmount = Number(payload.amount)
  if (!Number.isFinite(rawAmount)) {
    return { status: 'unverifiable', reason: 'missing amount' }
  }

  const currency = toLower(payload.currency)
  if (!currency) {
    return { status: 'unverifiable', reason: 'missing currency' }
  }

  const paidAmountUAH = Math.round(rawAmount)
  const expected = Math.round(Number(expectedTotalUAH) || 0)

  if (currency !== 'uah' || paidAmountUAH !== expected) {
    return {
      status: 'mismatch',
      paidAmountUAH,
      paidCurrency: currency,
      expectedUAH: expected,
    }
  }

  return { status: 'ok' }
}

export function mapLiqPayOrderStatus(
  payload: LiqPayStatusPayload,
): MappedOrderStatus {
  const status = toLower(payload.status)

  if (PAID_STATUSES.has(status)) return 'PAID'

  if (status === 'failure') {
    if (!hasTransactionId(payload)) return 'CANCELLED'
    return isCancellationSignal(payload) ? 'CANCELLED' : 'FAILED'
  }

  if (isCancellationSignal(payload)) return 'CANCELLED'

  if (
    status === 'error' ||
    status === 'reversed' ||
    status === 'unsubscribed'
  ) {
    return 'FAILED'
  }

  return null
}
