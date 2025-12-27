'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { pushMetaAddToCart } from '@/lib/analytics/datalayer'

type CartItem = {
  variantId: string
  productId: string
  name: string
  priceUAH: number
  qty: number
  strapName: string | null
  image: string
  slug: string
}
type CartState = {
  items: CartItem[]
  add: (item: CartItem) => void
  remove: (id: string, variantId: string) => void
  setQty: (id: string, variantId: string, qty: number) => void
  clear: () => void
  total: () => number
}
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        set((s) => {
          const i = s.items.findIndex(
            (x) =>
              x.productId === item.productId && x.variantId === item.variantId
          )
          if (i >= 0) {
            const copy = [...s.items]
            copy[i] = { ...copy[i], qty: copy[i].qty + item.qty }
            return { items: copy }
          }
          return { items: [...s.items, item] }
        })
        pushMetaAddToCart({
          contentId: item.variantId || item.productId,
          contentName: item.name,
          value: Number(item.priceUAH) * Number(item.qty),
          qty: item.qty,
          productId: item.productId,
          variantId: item.variantId,
          slug: item.slug,
        })
      },
      remove: (id, variantId) =>
        set((s) => ({
          items: s.items.filter(
            (i) => !(i.productId === id && i.variantId === variantId)
          ),
        })),
      setQty: (id, variantId, qty) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.productId === id && i.variantId === variantId ? { ...i, qty } : i
          ),
        })),
      clear: () => set({ items: [] }),
      total: () => get().items.reduce((sum, i) => sum + i.priceUAH * i.qty, 0),
    }),
    { name: 'cart-v1' }
  )
)
