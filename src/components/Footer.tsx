export default function Footer() {
  return (
    <footer className="border-t">
      <div className="max-w-6xl mx-auto px-4 py-8 text-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>© {new Date().getFullYear()} GERDAN</div>
        <nav className="flex gap-4 text-gray-600">
          <a className="hover:underline" href="/faq">
            FAQ
          </a>
          <a className="hover:underline" href="/policy">
            Політика
          </a>
          <a className="hover:underline" href="/contacts">
            Контакти
          </a>
        </nav>
      </div>
    </footer>
  )
}
