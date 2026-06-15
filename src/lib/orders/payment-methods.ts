export type CheckoutShippingMethod = 'nova_poshta' | 'international_address'
export type CheckoutPaymentMethod = 'LIQPAY' | 'BANK_TRANSFER'

export function isOnlinePaymentAvailableForShippingMethod(
  shippingMethod: CheckoutShippingMethod,
) {
  return shippingMethod === 'nova_poshta'
}

export function resolveCheckoutPaymentMethod(
  paymentMethod: CheckoutPaymentMethod | undefined,
  shippingMethod: CheckoutShippingMethod,
): CheckoutPaymentMethod {
  if (!isOnlinePaymentAvailableForShippingMethod(shippingMethod)) {
    return 'BANK_TRANSFER'
  }

  return paymentMethod ?? 'LIQPAY'
}
