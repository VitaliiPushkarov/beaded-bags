type CheckoutAttemptItem = {
  productId?: string | null
  variantId?: string | null
  qty: number
  priceUAH: number
  color?: string | null
  modelSize?: string | null
  pouchColor?: string | null
  strapName?: string | null
  addons?: Array<{
    addonVariantId: string
    qty: number
    priceUAH: number
  }> | null
}

export function buildCheckoutAttemptFingerprint(args: {
  items: CheckoutAttemptItem[]
  amountUAH: number
  paymentMethod: 'LIQPAY' | 'BANK_TRANSFER'
  customerPhone: string
  cityRef?: string
  warehouseRef?: string
  promoCode?: string | null
}) {
  return JSON.stringify({
    amountUAH: Math.round(Number(args.amountUAH) || 0),
    paymentMethod: args.paymentMethod,
    customerPhone: String(args.customerPhone ?? '').trim(),
    cityRef: String(args.cityRef ?? '').trim(),
    warehouseRef: String(args.warehouseRef ?? '').trim(),
    promoCode: String(args.promoCode ?? '').trim(),
    items: args.items.map((item) => ({
      productId: String(item.productId ?? ''),
      variantId: String(item.variantId ?? ''),
      qty: Math.trunc(Number(item.qty) || 0),
      priceUAH: Math.round(Number(item.priceUAH) || 0),
      color: String(item.color ?? ''),
      modelSize: String(item.modelSize ?? ''),
      pouchColor: String(item.pouchColor ?? ''),
      strapName: String(item.strapName ?? ''),
      addons: Array.isArray(item.addons)
        ? item.addons.map((addon) => ({
            addonVariantId: String(addon.addonVariantId ?? ''),
            qty: Math.trunc(Number(addon.qty) || 0),
            priceUAH: Math.round(Number(addon.priceUAH) || 0),
          }))
        : [],
    })),
  })
}
