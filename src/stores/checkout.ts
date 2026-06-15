import { create } from 'zustand'

import {
  DEFAULT_CHECKOUT_COUNTRY_CODE,
  getCheckoutCountryByCode,
} from '@/lib/checkout-countries'

type UIPaymentMethod = 'BANK_TRANSFER' | 'LIQPAY'

type NPDelivery = {
  areaRef?: string
  cityRef?: string
  cityName?: string
  warehouseRef?: string
  warehouseText?: string
}

type InternationalDelivery = {
  city?: string
  region?: string
  postalCode?: string
  addressLine1?: string
  addressLine2?: string
}

type CheckoutState = {
  deliveryMethod:
    | 'np_warehouse'
    | 'np_courier'
    | 'pickup'
    | 'international_address'
  shippingCountryCode: string
  shippingCountryName: string
  np: NPDelivery
  intl: InternationalDelivery
  paymentMethod: UIPaymentMethod
  setDeliveryMethod: (m: CheckoutState['deliveryMethod']) => void
  setShippingCountry: (countryCode: string) => void
  setNP: (p: Partial<NPDelivery>) => void
  setInternational: (p: Partial<InternationalDelivery>) => void
  setPaymentMethod: (m: UIPaymentMethod) => void
  resetDelivery: () => void
}

const defaultCountry = getCheckoutCountryByCode(DEFAULT_CHECKOUT_COUNTRY_CODE)

export const useCheckout = create<CheckoutState>()((set) => ({
  deliveryMethod: 'np_warehouse',
  shippingCountryCode: defaultCountry.code,
  shippingCountryName: defaultCountry.nameEn,
  np: {},
  intl: {},
  paymentMethod: 'LIQPAY',
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setDeliveryMethod: (deliveryMethod) => set({ deliveryMethod }),
  setShippingCountry: (countryCode) =>
    set(() => {
      const country = getCheckoutCountryByCode(countryCode)
      return {
        shippingCountryCode: country.code,
        shippingCountryName: country.nameEn,
        deliveryMethod:
          country.code === DEFAULT_CHECKOUT_COUNTRY_CODE
            ? 'np_warehouse'
            : 'international_address',
      }
    }),
  setNP: (p) => set((s) => ({ np: { ...s.np, ...p } })),
  setInternational: (p) => set((s) => ({ intl: { ...s.intl, ...p } })),
  resetDelivery: () =>
    set({
      deliveryMethod: 'np_warehouse',
      shippingCountryCode: defaultCountry.code,
      shippingCountryName: defaultCountry.nameEn,
      np: {},
      intl: {},
    }),
}))
