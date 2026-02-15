import { Suspense } from 'react'
import CheckoutClient from './CheckoutClient'

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Завантаження…</div>}>
      <CheckoutClient />
    </Suspense>
  )
}
