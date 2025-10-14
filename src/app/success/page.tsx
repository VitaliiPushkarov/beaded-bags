// After payment success page
'use client'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

export default function SuccessPage() {
  const sp = useSearchParams()
  const isMock = sp.get('mock') === '1'
  const orderId = sp.get('orderId') || ''
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmMock = async () => {
    try {
      setLoading(true)
      setError(null)
      const r = await fetch('/api/payments/mock-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await r.json()
      if (!r.ok || !data.ok)
        throw new Error(data?.error || 'Помилка підтвердження')
      setDone(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto text-center py-20">
      <h1 className="text-3xl font-bold mb-2">✅ Оплата (демо)</h1>
      <p className="text-gray-600 mb-6">Дякуємо за замовлення!</p>

      {isMock ? (
        <div className="space-y-3">
          <div className="text-sm text-gray-500">
            Режим розробки: підтвердь оплату вручну.
          </div>
          <button
            onClick={confirmMock}
            disabled={loading || !orderId || done}
            className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
          >
            {done
              ? 'Оплату підтверджено ✅'
              : loading
              ? 'Підтверджуємо...'
              : 'Підтвердити оплату (mock)'}
          </button>
          {!orderId && (
            <div className="text-xs text-red-600 mt-2">
              Відсутній orderId у URL.
            </div>
          )}
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
      ) : (
        <a href="/" className="underline">
          На головну
        </a>
      )}
    </div>
  )
}
