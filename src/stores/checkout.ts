import { create } from 'zustand'

type UIPaymentMethod = 'BANK_TRANSFER' | 'COD' | 'LIQPAY'

type NPDelivery = {
  areaRef?: string
  cityRef?: string
  cityName?: string
  warehouseRef?: string
  warehouseText?: string
}

type CheckoutState = {
  deliveryMethod: 'np_warehouse' | 'np_courier' | 'pickup'
  np: NPDelivery
  paymentMethod: UIPaymentMethod
  setDeliveryMethod: (m: CheckoutState['deliveryMethod']) => void
  setNP: (p: Partial<NPDelivery>) => void
  setPaymentMethod: (m: UIPaymentMethod) => void
  resetDelivery: () => void
}

export const useCheckout = create<CheckoutState>()((set) => ({
  deliveryMethod: 'np_warehouse',
  np: {},
  paymentMethod: 'BANK_TRANSFER',
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setDeliveryMethod: (deliveryMethod) => set({ deliveryMethod }),
  setNP: (p) => set((s) => ({ np: { ...s.np, ...p } })),
  resetDelivery: () => set({ deliveryMethod: 'np_warehouse', np: {} }),
}))
