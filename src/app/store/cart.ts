'use client'
import { create } from 'zustand'

type CartItem = {
  id: string
  name: string
  priceUAH: number
  qty: number
  image?: string
}
type CartState = {
  items: CartItem[]
  add: (item: CartItem) => void
  remove: (id: string) => void
  changeQty: (id: string, qty: number) => void
  clear: () => void
  total: () => number
}
export const useCart = create<CartState>((set, get) => ({
  items: [],
  add: (it) =>
    set((s) => {
      const ex = s.items.find((x) => x.id === it.id)
      return {
        items: ex
          ? s.items.map((x) =>
              x.id === it.id ? { ...x, qty: x.qty + it.qty } : x
            )
          : [...s.items, it],
      }
    }),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  changeQty: (id, qty) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, qty } : i)),
    })),
  clear: () => set({ items: [] }),
  total: () => get().items.reduce((sum, i) => sum + i.priceUAH * i.qty, 0),
}))
