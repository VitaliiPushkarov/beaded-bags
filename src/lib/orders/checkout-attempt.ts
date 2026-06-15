type CheckoutAttemptItem = {
  productId?: string | null
  variantId?: string | null
  strapId?: string | null
  sizeId?: string | null
  pouchId?: string | null
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
  shippingMethod?: 'nova_poshta' | 'international_address'
  cityRef?: string
  warehouseRef?: string
  shippingCountryCode?: string
  shippingCity?: string
  shippingRegion?: string
  shippingPostalCode?: string
  shippingAddressLine1?: string
  shippingAddressLine2?: string
  promoCode?: string | null
}) {
  return JSON.stringify({
    amountUAH: Math.round(Number(args.amountUAH) || 0),
    paymentMethod: args.paymentMethod,
    customerPhone: String(args.customerPhone ?? '').trim(),
    shippingMethod: String(args.shippingMethod ?? '').trim(),
    cityRef: String(args.cityRef ?? '').trim(),
    warehouseRef: String(args.warehouseRef ?? '').trim(),
    shippingCountryCode: String(args.shippingCountryCode ?? '').trim(),
    shippingCity: String(args.shippingCity ?? '').trim(),
    shippingRegion: String(args.shippingRegion ?? '').trim(),
    shippingPostalCode: String(args.shippingPostalCode ?? '').trim(),
    shippingAddressLine1: String(args.shippingAddressLine1 ?? '').trim(),
    shippingAddressLine2: String(args.shippingAddressLine2 ?? '').trim(),
    promoCode: String(args.promoCode ?? '').trim(),
    items: args.items.map((item) => ({
      productId: String(item.productId ?? ''),
      variantId: String(item.variantId ?? ''),
      strapId: String(item.strapId ?? ''),
      sizeId: String(item.sizeId ?? ''),
      pouchId: String(item.pouchId ?? ''),
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
