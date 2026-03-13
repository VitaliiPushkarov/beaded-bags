import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import AdminSidebar from '@/components/admin/AdminSidebar'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-shell">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col md:flex-row">
        <AdminSidebar />
        <div className="min-w-0 flex-1">
          <header className="admin-topbar">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                Management
              </p>
              <p className="text-sm font-medium text-slate-900">
                Облік і операційний контроль
              </p>
            </div>
          </header>
          <main className="admin-content px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
