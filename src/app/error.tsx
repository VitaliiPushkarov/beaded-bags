'use client'

import { useEffect } from 'react'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // лог у консоль/бекенд/аналітику
    console.error('App route error:', error)
  }, [error])

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-4xl sm:text-5xl font-fixel-display tracking-wide">
          Ой! Щось пішло не так
        </h1>
        <p className="mt-4 text-gray-600">
          Сталася неочікувана помилка. Спробуйте ще раз або поверніться на
          головну.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded bg-black text-white py-3 px-5 hover:bg-[#FF3D8C] transition"
          >
            Спробувати ще раз
          </button>

          <a
            href="/"
            className="inline-flex items-center justify-center rounded border border-gray-300 py-3 px-5 hover:bg-gray-50 transition"
          >
            На головну
          </a>
        </div>

        {error?.message ? (
          <pre className="mt-8 text-xs text-gray-400 whitespace-pre-wrap break-words">
            {error.message}
            {error.digest ? `\n\n#${error.digest}` : null}
          </pre>
        ) : null}
      </div>
    </main>
  )
}
