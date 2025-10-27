'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/app/store/cart'
import { useUI } from '@/app/store/ui'
import { useIsMounted } from '@/lib/useIsMounted'

export default function CartDrawer() {
  const cartOpen = useUI((s) => s.cartOpen)
  const closeCart = useUI((s) => s.closeCart)
  const items = useCart((s) => s.items)
  const total = useCart((s) => s.total)
  const setQty = useCart((s) => s.setQty)
  const remove = useCart((s) => s.remove)
  const isMounted = useIsMounted()

  // lock body scroll when open
  useEffect(() => {
    if (!cartOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [cartOpen])

  return (
    <>
      <div
        className={`fixed inset-0 ${
          cartOpen ? '' : 'pointer-events-none'
        } z-[80]`}
      >
        {/* Backdrop */}
        <div
          aria-hidden
          className={`fixed inset-0 bg-black/40 transition-opacity ${
            cartOpen
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
          onClick={closeCart}
        />

        {/* Panel */}
        <aside
          role="dialog"
          aria-label="Кошик"
          className={` fixed top-0 right-0 h-dvh bg-white shadow-2xl transition-transform duration-300
                    w-full sm:w-[480px] lg:w-[33.333%]
                    ${cartOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-xl font-medium" suppressHydrationWarning>
              Кошик {isMounted && items.length ? `(${items.length})` : ''}
            </h2>
            <button
              onClick={closeCart}
              aria-label="Закрити"
              className="text-5xl font-light leading-none cursor-pointer"
            >
              <span className="text-2xl leading-none">&times;</span>
            </button>
          </div>

          <div className="h-[calc(100dvh-220px)] overflow-auto px-5 py-4 space-y-4">
            {items.length === 0 && <p>Кошик порожній.</p>}

            {items.map((it) => (
              <div
                key={`${it.productId}-${it.variantId}`}
                className="grid grid-cols-[96px,1fr,auto] gap-4 items-start border rounded px-3 py-3"
              >
                <div className="inline-flex gap-6">
                  <div className="relative h-20 w-24 bg-gray-100 rounded overflow-hidden">
                    <Image
                      src={it.image}
                      alt={it.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="min-w-0">
                    <Link
                      href={`/products/${it.slug}`}
                      onClick={closeCart}
                      className="block font-medium hover:underline truncate"
                    >
                      {it.name}
                    </Link>
                    <div className="text-sm mt-1 text-gray-600">
                      {it.priceUAH} грн
                    </div>

                    <button
                      onClick={() => {
                        remove(it.productId, it.variantId)
                        closeCart()
                      }}
                      className="mt-2 text-rose-600 hover:text-rose-700 text-sm cursor-pointer"
                    >
                      Видалити
                    </button>
                  </div>
                </div>

                <div className="justify-self-end">
                  <div className="inline-flex items-center gap-3">
                    <button
                      className="h-8 w-8 rounded border cursor-pointer"
                      onClick={() => {
                        const next = it.qty - 1
                        if (next <= 0) {
                          remove(it.productId, it.variantId)
                          closeCart()
                        } else {
                          setQty(it.productId, it.variantId, next)
                        }
                      }}
                      aria-label="Менше"
                    >
                      −
                    </button>
                    <span className="w-6 text-center">{it.qty}</span>
                    <button
                      className="h-8 w-8 rounded bg-black text-white hover:bg-[#FF3D8C] transition cursor-pointer"
                      onClick={() =>
                        setQty(it.productId, it.variantId, it.qty + 1)
                      }
                      aria-label="Більше"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 border-t px-5 py-4 space-y-3 bg-white">
            <div
              className="flex items-center justify-between text-lg"
              suppressHydrationWarning
            >
              <span>Разом:</span>
              <span className="font-semibold">
                {isMounted ? total() : 0} грн
              </span>
            </div>

            <Link
              href="/cart"
              onClick={closeCart}
              className="block w-full text-center rounded bg-black text-white py-3 hover:bg-[#FF3D8C] transition"
            >
              Переглянути кошик
            </Link>

            <Link
              href="/checkout"
              onClick={closeCart}
              className="block w-full text-center rounded border border-black py-3 hover:bg-black hover:text-white transition"
            >
              Оформлення замовлення
            </Link>
          </div>
        </aside>
      </div>
    </>
  )
}
