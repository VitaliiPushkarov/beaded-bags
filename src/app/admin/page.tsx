import Link from 'next/link'

export default function AdminDashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Адмін-панель GERDAN</h1>
      <p className="text-sm text-gray-600">
        Керування товарами та замовленнями магазину.
      </p>
      <ul className="space-y-2 flex flex-col">
        <Link href="/admin/products">
          <li className="border rounded p-3 text-center bg-white hover:bg-red-300">
            👜 <strong>Товари</strong>
          </li>
        </Link>
        <Link href="/admin/orders">
          <li className="border rounded p-3 text-center bg-white hover:bg-red-300">
            📦 <strong>Замовлення</strong>
          </li>
        </Link>
      </ul>
    </div>
  )
}
