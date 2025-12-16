'use client'
import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { pushMetaPurchase } from '@/lib/analytics/datalayer'

function SuccessInner() {
  const sp = useSearchParams()
  const orderNumber = sp.get('order') ?? undefined

  // --- Meta Pixel via GTM: Purchase ---
  // Expecting a snapshot saved during checkout in sessionStorage under `gerdan_last_order_meta`.
  // Shape: { value: number, numItems: number, contentIds: string[] }
  const purchaseFiredRef = useRef(false)

  useEffect(() => {
    if (purchaseFiredRef.current) return
    if (!orderNumber) return

    try {
      const raw = sessionStorage.getItem('gerdan_last_order_meta')
      if (!raw) return

      const parsed = JSON.parse(raw) as {
        value?: number
        numItems?: number
        contentIds?: string[]
      }

      if (!parsed?.contentIds?.length) return
      if (typeof parsed.value !== 'number') return
      if (typeof parsed.numItems !== 'number') return

      purchaseFiredRef.current = true

      pushMetaPurchase({
        orderId: String(orderNumber),
        contentIds: parsed.contentIds.map(String),
        value: parsed.value,
        numItems: parsed.numItems,
        eventId: String(orderNumber),
      })

      // prevent accidental double-fires if user refreshes immediately
      sessionStorage.removeItem('gerdan_last_order_meta')
    } catch {
      // ignore
    }
  }, [orderNumber])

  return (
    <section className="min-h-[70vh] md:min-h-[80vh] w-full bg-[#FF3D8C] flex items-center justify-center px-6 py-10">
      <div className="text-white text-center max-w-2xl w-full flex flex-col items-center">
        <h1 className="text-[42px] md:text-[36px] font-semibold leading-tight">
          Дякуємо за замовлення!
        </h1>

        <p className="mt-3 text-[22px] sm:text-[28px] font-medium tracking-[0.2em]">
          № {orderNumber ? String(orderNumber).padStart(6, '0') : '—'}
        </p>

        <div className="mt-12 sm:mt-14 text-[20px] sm:text-[26px] leading-snug">
          <p>Лови 10% знижки на наступне, поки</p>
          <p>очікуєш повідомлення від нас 🤍</p>
        </div>

        <p className="mt-6 text-[22px] sm:text-[28px] font-semibold">
          промо: Gerdan10
        </p>
      </div>
    </section>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Завантаження…</div>}>
      <SuccessInner />
    </Suspense>
  )
}
