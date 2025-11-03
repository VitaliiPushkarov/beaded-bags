'use client'

import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-white text-gray-900">
        <div className="w-full max-w-xl text-center px-6">
          <h1 className="text-3xl sm:text-4xl font-fixel-display">
            Непередбачена помилка
          </h1>
          <p className="mt-4 text-gray-600">
            Виникла критична помилка у застосунку. Ми вже працюємо над
            виправленням.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="inline-flex items-center justify-center rounded bg-black text-white py-3 px-5 hover:bg-[#FF3D8C] transition"
            >
              Спробувати ще раз
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded border border-gray-300 py-3 px-5 hover:bg-gray-50 transition"
            >
              На головну
            </Link>
          </div>

          {error?.message ? (
            <pre className="mt-8 text-xs text-gray-400 whitespace-pre-wrap break-words">
              {error.message}
              {error.digest ? `\n\n#${error.digest}` : null}
            </pre>
          ) : null}
        </div>
      </body>
    </html>
  )
}
