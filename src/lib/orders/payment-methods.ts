export type CheckoutShippingMethod = 'nova_poshta' | 'international_address'
// UI-level choices at checkout. LIQPAY_PAYPART is PrivatBank "Оплата частинами"
// (payment in installments) — still LiqPay acquiring, so it resolves to the
// LIQPAY stored payment method with an installment paytype carried alongside.
export type CheckoutPaymentMethod = 'LIQPAY' | 'LIQPAY_PAYPART' | 'BANK_TRANSFER'
// The payment methods actually stored on an order.
export type ResolvedPaymentMethod = 'LIQPAY' | 'BANK_TRANSFER'
export type LiqPayInstallmentPaytype = 'paypart'

export function isOnlinePaymentAvailableForShippingMethod(
  shippingMethod: CheckoutShippingMethod,
) {
  return shippingMethod === 'nova_poshta'
}

export function resolveCheckoutPaymentMethod(
  paymentMethod: CheckoutPaymentMethod | undefined,
  shippingMethod: CheckoutShippingMethod,
): ResolvedPaymentMethod {
  if (!isOnlinePaymentAvailableForShippingMethod(shippingMethod)) {
    return 'BANK_TRANSFER'
  }

  // Installments are a LiqPay online payment under the hood.
  if (paymentMethod === 'LIQPAY_PAYPART') return 'LIQPAY'

  return paymentMethod === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'LIQPAY'
}

// Returns the LiqPay installment paytype for the checkout choice, or null when
// installments don't apply (non-online shipping, or a non-installment method).
export function resolveInstallmentPaytype(
  paymentMethod: CheckoutPaymentMethod | undefined,
  shippingMethod: CheckoutShippingMethod,
): LiqPayInstallmentPaytype | null {
  if (!isOnlinePaymentAvailableForShippingMethod(shippingMethod)) return null
  return paymentMethod === 'LIQPAY_PAYPART' ? 'paypart' : null
}
