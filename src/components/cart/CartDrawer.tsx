'use client'

import { useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/app/store/cart'
import { useUI } from '@/app/store/ui'
import { useIsMounted } from '@/lib/useIsMounted'
import { pushMetaInitiateCheckout } from '@/lib/analytics/datalayer'
import { usePromo } from '@/lib/usePromo'
import { resolvePromoCode, calcDiscountUAH } from '@/lib/promo'
import { useT } from '@/lib/i18n'

export default function CartDrawer() {
  const t = useT()
  const cartOpen = useUI((s) => s.cartOpen)
  const closeCart = useUI((s) => s.closeCart)
  const items = useCart((s) => s.items)
  const total = useCart((s) => s.total)
  const setQty = useCart((s) => s.setQty)
  const remove = useCart((s) => s.remove)
  const isMounted = useIsMounted()
  const checkoutFiredRef = useRef(false)

  const promo = usePromo()
  const appliedPromoCode = resolvePromoCode(promo)

  const subtotalUAH = useMemo(
    () => (isMounted ? total() : 0),
    [isMounted, items, total],
  )

  const discountUAH = useMemo(
    () => calcDiscountUAH(subtotalUAH, appliedPromoCode),
    [subtotalUAH, appliedPromoCode],
  )

  const finalTotalUAH = useMemo(
    () => Math.max(0, subtotalUAH - discountUAH),
    [subtotalUAH, discountUAH],
  )

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
        } z-80`}
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
          aria-label={t('Кошик', 'Cart')}
          className={` fixed top-0 right-0 h-dvh bg-white shadow-2xl transition-transform duration-300
                    w-full sm:w-[480px] lg:w-[33.333%]
                    ${cartOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b flex-none">
              <h2 className="text-xl font-medium" suppressHydrationWarning>
                {t('Кошик', 'Cart')}{' '}
                {isMounted && items.length ? `(${items.length})` : ''}
              </h2>
              <button
                onClick={closeCart}
                aria-label={t('Закрити', 'Close')}
                className="text-5xl font-light leading-none cursor-pointer flex items-center"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>

            {/* Scrollable items list */}
            <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
              {items.length === 0 && <p>{t('Кошик порожній.', 'Cart is empty.')}</p>}

              {items.map((it) => (
                <div
                  key={`${it.productId}-${it.variantId}-${it.strapId ?? ''}-${it.sizeId ?? ''}-${it.pouchId ?? ''}`}
                  className="grid grid-cols-[96px,1fr,auto] gap-4 items-start border rounded px-3 py-3"
                >
                  <div className="inline-flex gap-6">
                    <div className="relative md:h-24 md:w-24 h-[140px] w-[120px] bg-gray-100 rounded overflow-hidden">
                      <Image
                        src={it.image}
                        alt={it.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 96px"
                      />
                    </div>

                    <div className="min-w-0 flex flex-col items-start">
                      <Link
                        href={`/products/${it.slug}`}
                        onClick={closeCart}
                        className="block font-medium text-[18px] hover:underline "
                      >
                        {it.name}
                      </Link>
                      <div className="text-lg md:text-sm mt-1 text-gray-600">
                        {it.priceUAH} грн
                      </div>
                      {it.color && (
                        <div className="text-xs mt-1 text-gray-600">
                          {t('Колір', 'Color')}: {it.color}
                        </div>
                      )}
                      {it.modelSize && (
                        <div className="text-xs mt-1 text-gray-600">
                          {t('Розмір моделі', 'Size')}: {it.modelSize}
                        </div>
                      )}
                      {it.pouchColor && (
                        <div className="text-xs mt-1 text-gray-600">
                          {t('Мішечок', 'Pouch')}: {it.pouchColor}
                        </div>
                      )}
                      {it.strapName && (
                        <div className="text-xs mt-1 text-gray-600">
                          {t('Ремінець', 'Strap')}: {it.strapName}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          remove(
                            it.productId,
                            it.variantId,
                            it.strapId,
                            it.sizeId,
                            it.pouchId,
                          )
                        }}
                        className="mt-2 text-rose-600 hover:text-rose-700 text-sm cursor-pointer"
                      >
                        {t('Видалити', 'Remove')}
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
                            remove(
                              it.productId,
                              it.variantId,
                              it.strapId,
                              it.sizeId,
                              it.pouchId,
                            )
                          } else {
                            setQty(
                              it.productId,
                              it.variantId,
                              next,
                              it.strapId,
                              it.sizeId,
                              it.pouchId,
                            )
                          }
                        }}
                        aria-label={t('Менше', 'Decrease')}
                      >
                        −
                      </button>
                      <span className="w-6 text-center">{it.qty}</span>
                      <button
                        className="h-8 w-8 rounded bg-black text-white hover:bg-[#FF3D8C] transition cursor-pointer"
                        onClick={() => {
                          setQty(
                            it.productId,
                            it.variantId,
                            it.qty + 1,
                            it.strapId,
                            it.sizeId,
                            it.pouchId,
                          )
                        }}
                        aria-label={t('Більше', 'Increase')}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t px-5 py-4 space-y-3 bg-white flex-none">
              {discountUAH > 0 && (
                <div
                  className="flex items-center justify-between text-sm text-gray-600"
                  suppressHydrationWarning
                >
                  <span>{t('Знижка (промокод)', 'Discount (promo code)')}</span>
                  <span>- {discountUAH} грн</span>
                </div>
              )}

              <div
                className="flex items-center justify-between text-lg"
                suppressHydrationWarning
              >
                <span>{t('Разом', 'Total')}:</span>
                <span className="font-semibold">{finalTotalUAH} грн</span>
              </div>

              <Link
                href="/cart"
                onClick={closeCart}
                className="block w-full text-center rounded bg-black text-white py-3 hover:bg-[#FF3D8C] transition"
              >
                {t('Переглянути кошик', 'View cart')}
              </Link>

              <Link
                href={
                  appliedPromoCode
                    ? `/checkout?promo=${encodeURIComponent(appliedPromoCode)}`
                    : '/checkout'
                }
                onClick={() => {
                  if (!checkoutFiredRef.current && items.length) {
                    checkoutFiredRef.current = true

                    pushMetaInitiateCheckout({
                      contentIds: items.map((i) => i.variantId || i.productId),
                      value: finalTotalUAH,
                      numItems: items.reduce((s, i) => s + i.qty, 0),
                    })
                  }

                  closeCart()
                }}
                className="block w-full text-center rounded border border-black py-3 hover:bg-black hover:text-white transition"
              >
                {t('Оформлення замовлення', 'Checkout')}
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}
