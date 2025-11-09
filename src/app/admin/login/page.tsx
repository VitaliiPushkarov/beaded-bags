'use client'

import { FormEvent, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function AdminLoginInner() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const sp = useSearchParams()
  const from = sp.get('from') || '/admin'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const json = (await res.json()) as { error?: string; ok?: boolean }

      if (!res.ok) {
        setError(json.error || 'Помилка авторизації')
        return
      }

      router.push(from)
    } catch (err) {
      console.error(err)
      setError('Мережева помилка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white border rounded-lg shadow-sm p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold text-center mb-2">
          Вхід в адмін-панель
        </h1>

        <label className="block text-sm">
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-black"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full bg-black text-white py-2 rounded text-sm hover:bg-[#FF3D8C] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Вхід…' : 'Увійти'}
        </button>
      </form>
    </div>
  )
}
export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Завантаження…</div>}>
      <AdminLoginInner />
    </Suspense>
  )
}
