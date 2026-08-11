'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { pushMetaAddToCart } from '@/lib/analytics/datalayer'

type OrderItemAddon = {
  addonVariantId: string
  name: string
  priceUAH: number
  priceUSD?: number | null
  qty: number
}

type CartItem = {
  variantId: string
  productId: string
  name: string
  color: string | null
  modelSize: string | null
  pouchColor: string | null
  priceUAH: number
  priceUSD?: number | null
  qty: number
  strapId: string | null
  // Set instead of strapId when the line came from the pouch+strap
  // configurator: the id points at a different table.
  pouchStrapId?: string | null
  strapName: string | null
  sizeId: string | null
  pouchId: string | null
  image: string
  slug: string
  addons?: OrderItemAddon[]
}

// What makes two cart lines the same line: the product, the variant, and every
// option that can differ between them. Anything left out of here makes the two
// lines indistinguishable — React renders them under one key, and remove/setQty
// act on whichever comes first. That is what `pouchStrapId` did: the same pouch
// with a different strap produced two lines that behaved as one.
//
// The whole cart identifies lines through this one helper on purpose, so the
// next option added to the configurator has a single place to be declared.
// The option fields are optional here, not because callers may skip them —
// they pass the whole line — but because carts persisted before an option
// existed come back from localStorage without it. Missing and null mean the
// same thing: not chosen.
export type CartLineIdentity = {
  productId: string
  variantId: string
  strapId?: string | null
  pouchStrapId?: string | null
  sizeId?: string | null
  pouchId?: string | null
}

// '|' rather than '-': ids like `cozy-bag-00` already carry dashes, so a
// dash-joined key cannot be read back unambiguously.
export const cartLineKey = (line: CartLineIdentity): string =>
  [
    line.productId,
    line.variantId,
    line.strapId ?? '',
    line.pouchStrapId ?? '',
    line.sizeId ?? '',
    line.pouchId ?? '',
  ].join('|')

type CartState = {
  items: CartItem[]
  add: (item: CartItem) => void
  remove: (line: CartLineIdentity) => void
  setQty: (line: CartLineIdentity, qty: number) => void
  clear: () => void
  applyServerPrices: (updates: Array<{ index: number; priceUAH: number }>) => void
  total: () => number
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        set((s) => {
          const key = cartLineKey(item)
          const i = s.items.findIndex((x) => cartLineKey(x) === key)
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
      remove: (line) =>
        set((s) => {
          const key = cartLineKey(line)
          return { items: s.items.filter((i) => cartLineKey(i) !== key) }
        }),
      setQty: (line, qty) =>
        set((s) => {
          const key = cartLineKey(line)
          return {
            items: s.items.map((i) =>
              cartLineKey(i) === key ? { ...i, qty } : i,
            ),
          }
        }),
      clear: () => set({ items: [] }),
      // Correct stale cart prices from the server's repricing response. Indexes
      // refer to positions in the cart as it was submitted. The stored USD price
      // is dropped along with it: it was computed from the same stale UAH figure,
      // and showing a stale USD total would just move the problem.
      applyServerPrices: (updates) =>
        set((s) => {
          if (!updates.length) return s

          const priceByIndex = new Map(
            updates.map((update) => [update.index, update.priceUAH]),
          )

          return {
            items: s.items.map((item, index) => {
              const nextPrice = priceByIndex.get(index)
              if (nextPrice === undefined || nextPrice === item.priceUAH) {
                return item
              }
              return { ...item, priceUAH: nextPrice, priceUSD: null }
            }),
          }
        }),
      total: () => get().items.reduce((sum, i) => sum + i.priceUAH * i.qty, 0),
    }),
    { name: 'cart-v1' }
  )
)
