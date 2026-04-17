import CartClient from './CartClient'
import type { Metadata } from 'next'
import { getRequestLocale } from '@/lib/server-locale'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  return {
    title: locale === 'en' ? 'Cart' : 'Кошик',
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default function CartPage() {
  return <CartClient />
}
