/* 'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/app/store/cart'
import { Product } from '@/lib/products'

export default function ProductCard({ p }: { p: Product }) {
  const { add } = useCart()
  return (
    <div className="border rounded-lg p-3">
      <Link href={`/products/${p.slug}`}>
        <div className="aspect-square relative mb-3 bg-gray-100 rounded">
          <Image
            src={p.images[0]}
            alt={p.name}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={true}
            fill
            className="object-cover rounded"
          />
        </div>
        <div className="font-medium">{p.name}</div>
      </Link>
      <div className="flex items-center justify-between mt-2">
        <span>{p.priceUAH} грн</span>
        <button
          onClick={() =>
            add({
              id: p.id,
              name: p.name,
              priceUAH: p.priceUAH,
              qty: 1,
              image: p.images[0],
            })
          }
          className="text-sm bg-black text-white px-3 py-1.5 rounded"
        >
          У кошик
        </button>
      </div>
    </div>
  )
}
 */
