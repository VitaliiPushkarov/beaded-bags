import { Suspense } from 'react'
import CheckoutClient from './CheckoutClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Оформлення замовлення',
  robots: {
    index: false,
    follow: false,
  },
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Завантаження…</div>}>
      <CheckoutClient />
    </Suspense>
  )
}
