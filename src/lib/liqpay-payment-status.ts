export type LiqPayStatusPayload = {
  status?: unknown
  err_code?: unknown
  err_description?: unknown
  result?: unknown
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
