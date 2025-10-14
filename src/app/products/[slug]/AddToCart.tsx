'use client'
import { useCart } from '@/app/store/cart'
import { Product } from '@/lib/products'

export default function AddToCart({ p }: { p: Product }) {
  const { add } = useCart()
  return (
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
      className="bg-black text-white px-5 py-2 rounded cursor-pointer hover:bg-white transition hover:text-black"
    >
      Додати в кошик
    </button>
  )
}
