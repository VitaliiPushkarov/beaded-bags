import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type UIState = {
  cartOpen: boolean
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      cartOpen: false,
      openCart: () => set({ cartOpen: true }),
      closeCart: () => set({ cartOpen: false }),
      toggleCart: () => set((s) => ({ cartOpen: !s.cartOpen })),
    }),
    { name: 'ui-v1' }
  )
)
