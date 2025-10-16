'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/app/store/cart'
import { useUI } from '@/app/store/ui'

export default function CartButton() {
  const openCart = useUI((s) => s.openCart)
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.qty, 0))
  return (
    <button
      type="button"
      onClick={openCart}
      aria-label="Відкрити кошик"
      className="relative inline-flex h-8 w-8 items-center justify-center"
    >
      <Image
        src="/icons/bag-cart.svg"
        alt=""
        width={24}
        height={24}
        className="object-contain"
      />
      {count > 0 && (
        <span
          aria-live="polite"
          className="absolute -top-1 -right-1 min-w-4 h-4 px-1.5 rounded-full bg-red-500 text-white text-[10px] leading-none flex items-center justify-center font-medium"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}
