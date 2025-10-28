import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Увійти — GERDAN',
  description:
    'Сторінка авторизації тимчасово в розробці. Незабаром тут зʼявиться вхід до особистого кабінету.',
}

export default function LoginPlaceholder() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-3xl sm:text-4xl font-fixel-display tracking-wide">
          Увійти
        </h1>

        <p className="mt-4 text-gray-600">
          Особистий кабінет наразі в розробці. Дуже скоро ви зможете
          відстежувати замовлення, зберігати адреси та список бажань.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded bg-black text-white py-3 px-4 hover:bg-[#FF3D8C] transition"
          >
            До каталогу
          </Link>
          <Link
            href="/cart"
            className="inline-flex items-center justify-center rounded border border-gray-300 py-3 px-4 hover:bg-gray-50 transition"
          >
            Перейти в кошик
          </Link>
        </div>

        {/* Декоративна “форма” — неактивна, як індикатор майбутнього функціоналу */}
        <div className="mt-12 max-w-md mx-auto text-left">
          <div className="space-y-3">
            <input
              disabled
              type="email"
              placeholder="Email (скоро)"
              className="w-full rounded border border-gray-300 px-3 py-2 bg-gray-100 text-gray-500 cursor-not-allowed"
            />
            <input
              disabled
              type="password"
              placeholder="Пароль (скоро)"
              className="w-full rounded border border-gray-300 px-3 py-2 bg-gray-100 text-gray-500 cursor-not-allowed"
            />
            <button
              disabled
              className="w-full rounded bg-gray-200 text-gray-500 py-3 cursor-not-allowed"
            >
              Незабаром
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
