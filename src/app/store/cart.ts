'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { pushMetaAddToCart } from '@/lib/analytics/datalayer'

type OrderItemAddon = {
  addonVariantId: string
  name: string
  priceUAH: number
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
  qty: number
  strapId: string | null
  strapName: string | null
  sizeId: string | null
  pouchId: string | null
  image: string
  slug: string
  addons?: OrderItemAddon[]
}

type CartState = {
  items: CartItem[]
  add: (item: CartItem) => void
  remove: (
    id: string,
    variantId: string,
    strapId?: string | null,
    sizeId?: string | null,
    pouchId?: string | null,
  ) => void
  setQty: (
    id: string,
    variantId: string,
    qty: number,
    strapId?: string | null,
    sizeId?: string | null,
    pouchId?: string | null,
  ) => void
  clear: () => void
  total: () => number
}

const normalizeStrapId = (strapId: string | null | undefined) => strapId ?? null
const normalizeSizeId = (sizeId: string | null | undefined) => sizeId ?? null
const normalizePouchId = (pouchId: string | null | undefined) => pouchId ?? null

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        set((s) => {
          const i = s.items.findIndex(
            (x) =>
              x.productId === item.productId &&
              x.variantId === item.variantId &&
              normalizeStrapId(x.strapId) === normalizeStrapId(item.strapId) &&
              normalizeSizeId(x.sizeId) === normalizeSizeId(item.sizeId) &&
              normalizePouchId(x.pouchId) === normalizePouchId(item.pouchId)
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
      remove: (id, variantId, strapId, sizeId, pouchId) =>
        set((s) => ({
          items: s.items.filter(
            (i) =>
              !(
                i.productId === id &&
                i.variantId === variantId &&
                normalizeStrapId(i.strapId) === normalizeStrapId(strapId) &&
                normalizeSizeId(i.sizeId) === normalizeSizeId(sizeId) &&
                normalizePouchId(i.pouchId) === normalizePouchId(pouchId)
              )
          ),
        })),
      setQty: (id, variantId, qty, strapId, sizeId, pouchId) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.productId === id &&
            i.variantId === variantId &&
            normalizeStrapId(i.strapId) === normalizeStrapId(strapId) &&
            normalizeSizeId(i.sizeId) === normalizeSizeId(sizeId) &&
            normalizePouchId(i.pouchId) === normalizePouchId(pouchId)
              ? { ...i, qty }
              : i
          ),
        })),
      clear: () => set({ items: [] }),
      total: () => get().items.reduce((sum, i) => sum + i.priceUAH * i.qty, 0),
    }),
    { name: 'cart-v1' }
  )
)
