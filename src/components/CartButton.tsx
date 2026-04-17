'use client'
import Image from 'next/image'
import { useCart } from '@/app/store/cart'
import { useUI } from '@/app/store/ui'
import { useIsMounted } from '@/lib/useIsMounted'
import { useT } from '@/lib/i18n'

export default function CartButton() {
  const openCart = useUI((s) => s.openCart)
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.qty, 0))
  const isMounted = useIsMounted()
  const t = useT()
  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={t('Відкрити кошик', 'Open cart')}
      className="relative inline-flex h-8 w-8 items-center justify-center cursor-pointer"
    >
      <Image
        src="/icons/bag-cart.svg"
        alt="bag cart icon"
        width={22}
        height={22}
        className="object-contain"
      />
      {isMounted && count > 0 && (
        <span
          aria-live="polite"
          className="absolute -top-1 -right-1 min-w-4 h-4 px-1.5 rounded-full bg-red-500 text-white text-[10px] leading-none flex items-center justify-center font-medium"
        >
          {count}
        </span>
      )}
    </button>
  )
}
