// Whether a paid order actually produced a ПРРО receipt.
//
// LiqPay reports this as `rro_receipt_status` inside the payment payload, which
// the shop stores verbatim in `Order.paymentRaw`. Two things make that stored
// copy an unreliable record on its own:
//
//   - it is a snapshot taken when the callback arrived, and LiqPay can complete
//     the fiscalization afterwards, so a stored "failure" may since have become
//     a success;
//   - it is absent entirely on older payments and on any order whose callback
//     predates fiscalization being switched on.
//
// So the stored value is treated as a hint, and `refreshOrderFromLiqPayStatusApi`
// is what turns it back into ground truth.

export type FiscalReceiptState = 'success' | 'failure' | 'unknown'

export type FiscalReceiptStatus = {
  state: FiscalReceiptState
  errorDescription: string | null
  ticketUrl: string | null
}

function readString(source: Record<string, unknown>, key: string) {
  const value = source[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function readFiscalReceiptStatus(
  paymentRaw: unknown,
): FiscalReceiptStatus {
  if (!paymentRaw || typeof paymentRaw !== 'object' || Array.isArray(paymentRaw)) {
    return { state: 'unknown', errorDescription: null, ticketUrl: null }
  }

  const payload = paymentRaw as Record<string, unknown>
  const raw = readString(payload, 'rro_receipt_status')?.toLowerCase() ?? null

  const state: FiscalReceiptState =
    raw === 'success' ? 'success' : raw === 'failure' ? 'failure' : 'unknown'

  return {
    state,
    errorDescription: readString(payload, 'rro_err_description'),
    // Present only once a receipt exists — its absence is itself a signal that
    // nothing was fiscalized, even when no explicit failure was reported.
    ticketUrl: readString(payload, 'rro_ticket_url'),
  }
}

export function isFiscalized(paymentRaw: unknown) {
  return readFiscalReceiptStatus(paymentRaw).state === 'success'
}
