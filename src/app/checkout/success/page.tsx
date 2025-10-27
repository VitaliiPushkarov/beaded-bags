'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function SuccessInner() {
  const sp = useSearchParams()
  const orderId = sp.get('orderId') ?? undefined

  return (
    <section className="max-w-xl mx-auto p-6 text-center">
      <h1 className="text-2xl font-semibold">Дякуємо!</h1>
      <p className="mt-2">
        Якщо оплата пройшла успішно, замовлення буде підтверджено найближчим
        часом.
      </p>
      {orderId && (
        <p className="mt-3 text-sm text-gray-600">
          Номер замовлення: <b>{orderId}</b>
        </p>
      )}
      <div className="mt-6">
        <Link href="/" className="underline">
          На головну
        </Link>
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
