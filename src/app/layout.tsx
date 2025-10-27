import './globals.css'
import type { Metadata } from 'next'
import Header from '../components/Header'
import CartDrawer from '@/components/cart/CartDrawer'

export const metadata: Metadata = { title: 'GERDAN' }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uk">
      <body className="min-h-screen text-gray-900 antialiased bg-white font-fixel">
        <Header />
        <main className="max-w-full mx-auto md:py-8">{children}</main>
        <CartDrawer />
      </body>
    </html>
  )
}
