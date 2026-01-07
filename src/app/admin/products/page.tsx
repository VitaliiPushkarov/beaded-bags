import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import type { ProductType } from '@prisma/client'

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    include: { variants: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-semibold">Товари</h1>
        <Link
          href="/admin/products/new"
          className="bg-black text-white px-4 py-2 rounded text-sm hover:bg-[#FF3D8C] inline-flex items-center justify-center"
        >
          + Додати товар
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="border rounded bg-white p-4">
          <p className="text-sm text-gray-600">Поки що немає товарів.</p>
        </div>
      ) : (
        <div className="border rounded bg-white">
          {/* Mobile cards */}
          <div className="md:hidden divide-y">
            {products.map((p) => (
              <div key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/products/${p.slug}`}
                      className="font-medium hover:underline wrap-break-word"
                      target="_blank"
                    >
                      {p.name}
                    </Link>
                    <div className="mt-1 text-xs text-gray-600 wrap-break-word">
                      <span className="text-gray-500">Тип:</span>{' '}
                      {p.type as ProductType}
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      <span className="text-gray-500">Базова ціна:</span>{' '}
                      {p.basePriceUAH != null ? `${p.basePriceUAH} ₴` : '—'}
                      <span className="mx-2 text-gray-300">•</span>
                      <span className="text-gray-500">Варіантів:</span>{' '}
                      {p.variants.length}
                    </div>
                  </div>

                  <Link
                    href={`/admin/products/${p.id}`}
                    className="shrink-0 text-xs underline"
                  >
                    Редагувати
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Назва</th>
                  <th className="p-2 text-left">Тип</th>
                  <th className="p-2 text-right">Базова ціна</th>
                  <th className="p-2 text-center">Варіантів</th>
                  <th className="p-2 text-right">Дії</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2">
                      <Link
                        href={`/products/${p.slug}`}
                        className="text-blue-600 hover:underline"
                        target="_blank"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="p-2">{p.type as ProductType}</td>
                    <td className="p-2 text-right">
                      {p.basePriceUAH != null ? `${p.basePriceUAH} ₴` : '—'}
                    </td>
                    <td className="p-2 text-center">{p.variants.length}</td>
                    <td className="p-2 text-right">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Редагувати
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
