import { Suspense } from 'react'
import type { Metadata } from 'next'
import SuccessClient from './SuccessClient'

export const metadata: Metadata = {
  title: 'Оплата',
  robots: {
    index: false,
    follow: false,
  },
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Завантаження…</div>}>
      <SuccessClient />
    </Suspense>
  )
}
