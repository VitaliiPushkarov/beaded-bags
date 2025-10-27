'use client'
import { useEffect, useRef } from 'react'

export default function PayPage({
  searchParams,
}: {
  searchParams: { data?: string; signature?: string; url?: string }
}) {
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (searchParams.data && searchParams.signature) {
      formRef.current?.submit()
    }
  }, [searchParams.data, searchParams.signature])

  const action = searchParams.url || 'https://www.liqpay.ua/api/3/checkout'

  if (!searchParams.data || !searchParams.signature) {
    return <div className="p-6">Немає даних для оплати</div>
  }

  return (
    <div className="p-6">
      <p className="mb-4">Переходимо на платіжну сторінку…</p>
      <form ref={formRef} method="POST" action={action}>
        <input type="hidden" name="data" value={searchParams.data} />
        <input type="hidden" name="signature" value={searchParams.signature} />
        <noscript>
          <button className="rounded bg-black text-white px-4 py-2">
            Перейти до LiqPay
          </button>
        </noscript>
      </form>
    </div>
  )
}
