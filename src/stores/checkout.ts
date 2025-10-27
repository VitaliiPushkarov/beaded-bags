import { create } from 'zustand'

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
  setDeliveryMethod: (m: CheckoutState['deliveryMethod']) => void
  setNP: (p: Partial<NPDelivery>) => void
  resetDelivery: () => void
}

export const useCheckout = create<CheckoutState>()((set) => ({
  deliveryMethod: 'np_warehouse',
  np: {},
  setDeliveryMethod: (deliveryMethod) => set({ deliveryMethod }),
  setNP: (p) => set((s) => ({ np: { ...s.np, ...p } })),
  resetDelivery: () => set({ deliveryMethod: 'np_warehouse', np: {} }),
}))
