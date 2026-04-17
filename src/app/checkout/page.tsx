import { Suspense } from 'react'
import CheckoutClient from './CheckoutClient'
import type { Metadata } from 'next'
import { getRequestLocale } from '@/lib/server-locale'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  return {
    title: locale === 'en' ? 'Checkout' : 'Оформлення замовлення',
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function CheckoutPage() {
  const locale = await getRequestLocale()
  return (
    <Suspense
      fallback={
        <div className="p-6 text-center">
          {locale === 'en' ? 'Loading...' : 'Завантаження…'}
        </div>
      }
    >
      <CheckoutClient />
    </Suspense>
  )
}
