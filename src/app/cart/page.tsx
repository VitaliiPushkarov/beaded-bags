// Cart page
'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '../store/cart'

export default function CartPage() {
  const { items, changeQty, remove, total } = useCart()

  if (!items.length) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Кошик</h1>
        <p>Кошик порожній.</p>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-[1fr,320px] gap-8">
      <div className="space-y-4">
        {items.map((it) => (
          <div
            key={it.id}
            className="flex items-center gap-4 border rounded p-3"
          >
            <div className="relative w-20 h-20 bg-gray-100 rounded">
              {it.image && (
                <Image
                  src={it.image}
                  alt={it.name}
                  fill
                  className="object-cover rounded"
                />
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium">{it.name}</div>
              <div className="text-sm text-gray-600">{it.priceUAH} грн</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeQty(it.id, Math.max(1, it.qty - 1))}
                className="px-2 border rounded"
              >
                –
              </button>
              <div className="w-8 text-center">{it.qty}</div>
              <button
                onClick={() => changeQty(it.id, it.qty + 1)}
                className="px-2 border rounded"
              >
                +
              </button>
            </div>
            <button
              onClick={() => remove(it.id)}
              className="text-sm text-red-600 ml-2"
            >
              Прибрати
            </button>
          </div>
        ))}
      </div>

      <aside className="border rounded p-4 h-fit">
        <div className="flex items-center justify-between mb-2">
          <span>Сума</span>
          <span className="font-semibold">{total()} грн</span>
        </div>
        <Link
          href="/checkout"
          className="block text-center bg-black text-white py-2 rounded mt-3"
        >
          Оформити замовлення
        </Link>
      </aside>
    </div>
  )
}
