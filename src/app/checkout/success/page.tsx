'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { pushMetaPurchase } from '@/lib/analytics/datalayer'
import { useCart } from '@/app/store/cart'

const CHECKOUT_FORM_DRAFT_KEY = 'gerdan_checkout_form_draft'
const CHECKOUT_ATTEMPT_META_KEY = 'gerdan_checkout_attempt_meta'
const ORDER_STATUS_POLL_INTERVAL_MS = 1500
const ORDER_STATUS_MAX_POLLS = 20

type PublicOrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'FULFILLED'

function SuccessInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const orderRaw = sp.get('order')
  const orderNumber = orderRaw && orderRaw.trim() ? orderRaw.trim() : undefined
  const orderIdRaw = sp.get('orderId')
  const orderId = orderIdRaw && orderIdRaw.trim() ? orderIdRaw.trim() : undefined
  const isPendingReturn = sp.get('pending') === '1'
  const clearCart = useCart((s) => s.clear)
  const [settlementStatus, setSettlementStatus] = useState<PublicOrderStatus | null>(
    isPendingReturn ? 'PENDING' : 'PAID',
  )
  const [settlementTimedOut, setSettlementTimedOut] = useState(false)
  const isAwaitingSettlement = isPendingReturn && settlementStatus !== 'PAID'
  const canShowSuccess = Boolean(orderNumber) && !isAwaitingSettlement

  useEffect(() => {
    // LiqPay cancel flow can return to success page with an empty order query.
    // In that case, send user to homepage instead of showing a fake success state.
    if (orderNumber === undefined) {
      router.replace('/')
    }
  }, [orderNumber, router])

  useEffect(() => {
    if (!isPendingReturn || !orderNumber || !orderId) return

    let cancelled = false

    const pollStatus = async () => {
      for (let attempt = 0; attempt < ORDER_STATUS_MAX_POLLS; attempt += 1) {
        try {
          const res = await fetch(
            `/api/orders/status?orderId=${encodeURIComponent(orderId)}&order=${encodeURIComponent(orderNumber)}`,
            {
              method: 'GET',
              cache: 'no-store',
            },
          )

          if (!res.ok) {
            if (res.status === 404 && !cancelled) {
              router.replace('/')
              return
            }
          } else {
            const json = (await res.json()) as { status?: PublicOrderStatus }
            const status = json.status

            if (!status) {
              // keep polling
            } else if (status === 'PAID' || status === 'FULFILLED') {
              if (!cancelled) {
                setSettlementTimedOut(false)
                setSettlementStatus('PAID')
              }
              return
            } else if (status === 'FAILED') {
              if (!cancelled) router.replace('/checkout?payment=failed')
              return
            } else if (status === 'CANCELLED') {
              if (!cancelled) router.replace('/checkout?payment=cancelled')
              return
            } else if (!cancelled) {
              setSettlementStatus(status)
            }
          }
        } catch {
          // ignore transient polling errors
        }

        await new Promise((resolve) =>
          window.setTimeout(resolve, ORDER_STATUS_POLL_INTERVAL_MS),
        )
      }

      if (!cancelled) {
        setSettlementTimedOut(true)
      }
    }

    void pollStatus()

    return () => {
      cancelled = true
    }
  }, [isPendingReturn, orderId, orderNumber, router])

  useEffect(() => {
    if (!canShowSuccess) return
    clearCart()
    try {
      sessionStorage.removeItem(CHECKOUT_FORM_DRAFT_KEY)
      sessionStorage.removeItem(CHECKOUT_ATTEMPT_META_KEY)
    } catch {}
  }, [canShowSuccess, clearCart])

  // --- Meta Pixel via GTM: Purchase ---
  // Expecting a snapshot saved during checkout in sessionStorage under `gerdan_last_order_meta`.
  // Shape: { value: number, numItems: number, contentIds: string[] }
  const purchaseFiredRef = useRef(false)

  useEffect(() => {
    if (purchaseFiredRef.current) return
    if (!canShowSuccess || !orderNumber) return

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
  }, [canShowSuccess, orderNumber])

  if (isAwaitingSettlement) {
    return (
      <section className="min-h-[70vh] md:min-h-[80vh] w-full bg-[#FF3D8C] flex items-center justify-center px-6 py-10">
        <div className="text-white text-center max-w-2xl w-full flex flex-col items-center">
          <h1 className="text-[42px] md:text-[36px] font-semibold leading-tight">
            Підтверджуємо оплату
          </h1>

          <p className="mt-3 text-[22px] sm:text-[28px] font-medium tracking-[0.2em]">
            № {orderNumber ? String(orderNumber).padStart(6, '0') : '—'}
          </p>

          <p className="mt-10 text-[18px] sm:text-[24px] leading-snug max-w-xl">
            Оплата пройшла, чекаємо підтвердження від LiqPay та ПРРО перед
            фінальним переходом на сторінку замовлення.
          </p>

          {settlementTimedOut ? (
            <p className="mt-6 text-[16px] sm:text-[20px] leading-snug max-w-xl">
              Підтвердження триває довше, ніж очікувалось. Ми автоматично
              продовжимо перевірку після оновлення сторінки.
            </p>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="min-h-[70vh] md:min-h-[80vh] w-full bg-[#FF3D8C] flex items-center justify-center px-6 py-10">
      <div className="text-white text-center max-w-2xl w-full flex flex-col items-center">
        <h1 className="text-[42px] md:text-[36px] font-semibold leading-tight">
          Дякуємо за замовлення!
        </h1>

        <p className="mt-3 text-[22px] sm:text-[28px] font-medium tracking-[0.2em]">
          № {orderNumber ? String(orderNumber).padStart(6, '0') : '—'}
        </p>

        <div className="mt-12 sm:mt-14 text-[20px] sm:text-[26px] leading-snug whitespace-nowrap">
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
