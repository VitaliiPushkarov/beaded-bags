'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function SuccessInner() {
  const sp = useSearchParams()
  const orderNumber = sp.get('order') ?? undefined

  return (
    <section className="max-w-xl mx-auto p-6 text-center">
      <h1 className="text-2xl font-semibold">Дякуємо!</h1>
      <p className="mt-2">
        Ми скоро зʼявжемося з вами, щоб підтвердити ваше замовлення.
      </p>
      {orderNumber && (
        <p className="mt-3 text-sm text-gray-600">
          Номер замовлення: <b>{String(orderNumber).padStart(6, '0')}</b>
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
