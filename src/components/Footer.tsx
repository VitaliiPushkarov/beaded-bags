import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t py-8 text-sm text-gray-500">
      <div className="max-w-6xl mx-auto px-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>© {new Date().getFullYear()} GERDAN. Усі права захищені.</div>
        <div className="flex gap-4 flex-wrap">
          <Link href="/contacts" className="hover:text-gray-900">
            Контакти
          </Link>
          <Link href="/cashback" className="hover:text-gray-900">
            Умови обміну та повернення
          </Link>

          <Link href="/policy" className="hover:text-gray-900">
            Політика конфіденційності
          </Link>
          <Link href="/blog" className="hover:text-gray-900">
            Блог
          </Link>
        </div>
      </div>
    </footer>
  )
}
