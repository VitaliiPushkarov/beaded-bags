'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Toast = { kind: 'success' | 'error'; message: string }

// Reads the `success` / `error` query params set by admin server actions
// (via withAdminMessage), shows a toast, and strips the params from the URL
// so a refresh doesn't replay it. Mounted once in the admin layout.
export default function AdminToaster() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [toast, setToast] = useState<Toast | null>(null)

  const success = searchParams.get('success')
  const error = searchParams.get('error')

  useEffect(() => {
    if (!success && !error) return

    setToast(
      error
        ? { kind: 'error', message: error }
        : { kind: 'success', message: success as string },
    )

    // Strip the message params from the URL without adding history.
    const next = new URLSearchParams(searchParams.toString())
    next.delete('success')
    next.delete('error')
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success, error])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!toast) return null

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={`fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${
        toast.kind === 'error'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      }`}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => setToast(null)}
        className="shrink-0 font-medium underline"
        aria-label="Закрити"
      >
        ✕
      </button>
    </div>
  )
}
