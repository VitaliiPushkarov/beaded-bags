'use client'
import Link from 'next/link'
import { useCart } from '@/app/store/cart'
import SearchDialog from './search/SearchDialog'
import CartButton from './CartButton'

export default function Header() {
  const { items } = useCart()
  const count = items.reduce((s, i) => s + i.qty, 0)

  return (
    <header className="sticky top-0 z-40 font-fixel bg-[#D9D9D9]">
      <div className="max-w-full mx-auto px-[50px] py-3 flex items-center justify-between">
        <nav className="hidden sm:flex gap-6 text-sm text-gray-700">
          <Link href="/products" className="hover:underline">
            Новинки
          </Link>
          <Link href="/products" className="hover:underline">
            Сумки
          </Link>
          <Link href="/products" className="hover:underline">
            Аксесуари
          </Link>
        </nav>
        <Link href="/" className="tracking-[0.35em] text-3xl font-regular">
          GERDAN
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <SearchDialog />

          <CartButton />
          <a className="hidden sm:block hover:underline" href="#">
            Увійти
          </a>
        </nav>
      </div>
    </header>
  )
}
