export type LiqPayStatusPayload = {
  status?: unknown
  err_code?: unknown
  err_description?: unknown
  result?: unknown
  [key: string]: unknown
}

type MappedOrderStatus = 'PAID' | 'FAILED' | 'CANCELLED' | null

function toLower(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
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

  if (status === 'success' || status === 'sandbox') return 'PAID'

  if (status === 'failure') {
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
