import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import type { ProductType } from '@prisma/client'

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    include: { variants: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Товари</h1>
        <Link
          href="/admin/products/new"
          className="bg-black text-white px-4 py-2 rounded text-sm hover:bg-[#FF3D8C]"
        >
          + Додати товар
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-gray-600">Поки що немає товарів.</p>
      ) : (
        <div className="overflow-x-auto border rounded bg-white">
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
      )}
    </div>
  )
}
