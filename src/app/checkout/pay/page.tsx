'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

function PayInner() {
  const sp = useSearchParams()
  const data = sp.get('data') || ''
  const signature = sp.get('signature') || ''
  const action = sp.get('url') || 'https://www.liqpay.ua/api/3/checkout'

  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (data && signature) {
      formRef.current?.submit()
    }
  }, [data, signature])

  if (!data || !signature) {
    return <div className="p-6">Немає даних для оплати</div>
  }

  return (
    <div className="p-6">
      <p className="mb-4">Переходимо на платіжну сторінку…</p>
      <form ref={formRef} method="POST" action={action}>
        <input type="hidden" name="data" value={data} />
        <input type="hidden" name="signature" value={signature} />
        <noscript>
          <button className="rounded bg-black text-white px-4 py-2">
            Перейти до LiqPay
          </button>
        </noscript>
      </form>
    </div>
  )
}

export default function PayPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Завантаження…</div>}>
      <PayInner />
    </Suspense>
  )
}
