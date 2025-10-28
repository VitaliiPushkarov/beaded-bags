// src/app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-4xl sm:text-5xl font-fixel-display tracking-wide">
          404 — Сторінку не знайдено
        </h1>
        <p className="mt-4 text-gray-600">
          На жаль, такої сторінки не існує або її перенесено.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded bg-black text-white py-3 px-5 hover:bg-[#FF3D8C] transition"
          >
            На головну
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded border border-gray-300 py-3 px-5 hover:bg-gray-50 transition"
          >
            До каталогу
          </Link>
        </div>
      </div>
    </main>
  )
}
