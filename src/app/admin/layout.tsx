import type { ReactNode } from 'react'
import Link from 'next/link'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/admin" className="font-semibold">
            GERDAN Admin
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin/products">Товари</Link>
            <Link href="/admin/orders">Замовлення</Link>
            <Link href="/" className="text-gray-500">
              На сайт
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto px-6 py-6">{children}</main>
    </div>
  )
}
