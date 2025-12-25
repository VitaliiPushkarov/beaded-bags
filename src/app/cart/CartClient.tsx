'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCart } from '../store/cart'
import { pushMetaInitiateCheckout } from '@/lib/analytics/datalayer'

function QtyBox({
  onDec,
  onInc,
  value,
}: {
  onDec: () => void
  onInc: () => void
  value: number
}) {
  return (
    <div
      className="
      inline-flex items-center gap-3 px-3 py-2.5
      border border-black rounded
      text-lg 
    "
    >
      <button
        onClick={onDec}
        aria-label="Менше"
        className="text-2xl leading-none cursor-pointer"
      >
        −
      </button>
      <span className="w-6 text-center">{value}</span>
      <button
        onClick={onInc}
        aria-label="Більше"
        className="text-2xl leading-none cursor-pointer"
      >
        ＋
      </button>
    </div>
  )
}

const useCartItems = () => useCart((s) => s.items)
const useCartSetQty = () => useCart((s) => s.setQty)
const useCartRemove = () => useCart((s) => s.remove)
const useCartTotal = () => useCart((s) => s.total)

export default function CartPage() {
  const items = useCartItems()
  const setQty = useCartSetQty()
  const remove = useCartRemove()
  const total = useCartTotal()

  const checkoutFiredRef = useRef(false)

  // PROMO CODE
  const PROMO_CODE = 'GERDAN10'
  const PROMO_STORAGE_KEY = 'gerdan_promo_code'
  const DISCOUNT_PCT = 10

  const [promoInput, setPromoInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null)
  const [promoTouched, setPromoTouched] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PROMO_STORAGE_KEY)
      if (saved) {
        setAppliedPromo(saved)
        setPromoInput(saved)
      }
    } catch {}
  }, [])

  const normalizedPromoInput = promoInput.trim().toUpperCase()
  const isPromoValid = normalizedPromoInput === PROMO_CODE
  const isPromoApplied = appliedPromo?.toUpperCase() === PROMO_CODE

  const subtotalUAH = useMemo(() => total(), [total, items])

  const discountUAH = useMemo(() => {
    if (!isPromoApplied) return 0
    return Math.round((subtotalUAH * DISCOUNT_PCT) / 100)
  }, [isPromoApplied, subtotalUAH])

  const finalTotalUAH = useMemo(() => {
    return Math.max(0, subtotalUAH - discountUAH)
  }, [subtotalUAH, discountUAH])

  const applyPromo = () => {
    setPromoTouched(true)
    if (!isPromoValid) return

    setAppliedPromo(PROMO_CODE)
    try {
      window.localStorage.setItem(PROMO_STORAGE_KEY, PROMO_CODE)
    } catch {}
  }

  const removePromo = () => {
    setAppliedPromo(null)
    try {
      window.localStorage.removeItem(PROMO_STORAGE_KEY)
    } catch {}
  }

  return (
    <section className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6 lg:py-12">
      <h1 className="text-4xl lg:text-5xl font-fixel-display mb-8">Кошик</h1>

      <div className="grid lg:grid-cols-[1fr_460px] gap-10">
        {/* LEFT: таблиця */}
        <div>
          {/* заголовки таблиці */}
          <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr] gap-6 uppercase tracking-wide text-sm pb-3 border-b border-black ">
            <div>Товар</div>
            <div className="text-center">Ціна</div>
            <div className="text-center">Кількість</div>
            <div className="text-right">Разом</div>
          </div>

          {/* рядки */}
          <div className="divide-y">
            {items.map((it) => {
              const line = it.priceUAH * it.qty
              return (
                <div
                  key={`${it.productId}-${it.variantId}`}
                  className="py-6 grid lg:grid-cols-[2fr_1fr_1fr_1fr] gap-6 items-center border-b border-black"
                >
                  {/* Товар */}
                  <div className="flex items-start gap-6 min-w-0">
                    <div className="relative h-[120px] w-[120px] bg-gray-100 rounded overflow-hidden shrink-0">
                      <Image
                        src={it.image}
                        alt={it.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex flex-col items-start flex-wrap">
                      <Link
                        href={`/products/${it.slug}`}
                        className="block text-xl hover:underline"
                      >
                        {it.name}
                      </Link>
                      <div className="mt-2 text-gray-700">В наявності</div>
                      <button
                        onClick={() => remove(it.productId, it.variantId)}
                        className="mt-3 text-black underline underline-offset-4 hover:no-underline cursor-pointer"
                      >
                        Видалити
                      </button>
                    </div>
                  </div>

                  {/* Ціна */}
                  <div className="lg:text-center text-xl">
                    {it.priceUAH} грн
                  </div>

                  {/* Кількість */}
                  <div className="lg:text-center">
                    <QtyBox
                      value={it.qty}
                      onDec={() => {
                        const n = it.qty - 1
                        if (n <= 0) {
                          remove(it.productId, it.variantId)
                        } else {
                          setQty(it.productId, it.variantId, n)
                        }
                      }}
                      onInc={() =>
                        setQty(it.productId, it.variantId, it.qty + 1)
                      }
                    />
                  </div>

                  {/* Разом */}
                  <div className="lg:text-right text-xl font-medium">
                    {line} грн
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: сума замовлення */}
        <aside className="h-fit lg:sticky lg:top-8 border border-black rounded p-6 space-y-6 ">
          <h2 className="text-2xl font-fixel-display">Сума замовлення</h2>

          <div className="flex items-center justify-between text-lg">
            <span>Вартість замовлення</span>
            <span className="font-semibold">{subtotalUAH} грн</span>
          </div>

          {isPromoApplied && discountUAH > 0 && (
            <div className="flex items-center justify-between text-lg">
              <span className="text-gray-700">Знижка ({DISCOUNT_PCT}%)</span>
              <span className="font-semibold">−{discountUAH} грн</span>
            </div>
          )}

          <div>
            <div className="text-sm uppercase tracking-wide text-gray-700">
              Доставка
            </div>
            <div className="mt-2">Нова Пошта</div>
          </div>

          <div>
            <label className="block text-sm text-gray-700">Є промокод?</label>
            <div className="mt-2 flex">
              <input
                className="flex-1 border border-black rounded-l px-3 py-2 outline-none"
                placeholder="Введіть код"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                onBlur={() => setPromoTouched(true)}
              />
              {isPromoApplied ? (
                <button
                  type="button"
                  onClick={removePromo}
                  className="px-5 border border-l-0 border-black rounded-r hover:bg-black hover:text-white transition cursor-pointer"
                  aria-label="Remove promo"
                  title="Скасувати промокод"
                >
                  ✕
                </button>
              ) : (
                <button
                  type="button"
                  onClick={applyPromo}
                  className="px-5 border border-l-0 border-black rounded-r hover:bg-black hover:text-white transition cursor-pointer"
                  aria-label="Apply promo"
                  title="Застосувати промокод"
                >
                  →
                </button>
              )}
            </div>

            {promoTouched && promoInput.trim() && !isPromoApplied && !isPromoValid && (
              <p className="mt-2 text-xs text-rose-600">Невірний промокод</p>
            )}

            {isPromoApplied && (
              <p className="mt-2 text-xs text-green-700">
                Промокод застосовано: <span className="font-medium">{PROMO_CODE}</span>
              </p>
            )}
          </div>

          <div className="flex items-center justify-between text-xl pt-2">
            <span className="uppercase tracking-wide">Разом</span>
            <span className="font-semibold">{finalTotalUAH} грн</span>
          </div>
          <div className="w-full">
            <Link
              href={isPromoApplied ? `/checkout?promo=${PROMO_CODE}` : '/checkout'}
              onClick={() => {
                if (!checkoutFiredRef.current && items.length) {
                  checkoutFiredRef.current = true
                  pushMetaInitiateCheckout({
                    contentIds: items.map((i) => i.variantId || i.productId),
                    value: finalTotalUAH,
                    numItems: items.reduce((s, i) => s + i.qty, 0),
                  })
                }
              }}
              className="flex justify-center items-center w-full h-14 text-lg rounded bg-black text-white hover:bg-[#FF3D8C] transition cursor-pointer"
            >
              Перейти до оформлення
            </Link>
          </div>
        </aside>
      </div>
    </section>
  )
}
