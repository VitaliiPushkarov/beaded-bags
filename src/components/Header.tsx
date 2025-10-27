'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/app/store/cart'
import SearchDialog from './search/SearchDialog'
import CartButton from './CartButton'
import { useState, useEffect } from 'react'

export default function Header() {
  const { items } = useCart()
  const count = items.reduce((s, i) => s + i.qty, 0)

  const [borderColor, setBorderColor] = useState('white')
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 80) {
        // Define your scroll threshold
        setBorderColor('#d9d9d9') // Change to the desired color when scrolled
      } else {
        setBorderColor('white') // Revert to initial color when not scrolled
      }
    }

    window.addEventListener('scroll', handleScroll)

    // Clean up the event listener on component unmount
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <header
      className="sticky top-0 z-50 bg-white"
      style={{
        borderBottom: `1px solid ${borderColor}`,
        transition: 'border-color 0.3s ease',
      }}
    >
      <div className="max-w-full mx-auto lg:px-[50px] py-3 flex items-center justify-between gap-[130px] sm:px-6 lg:h-[86px] relative">
        <nav className="hidden sm:flex gap-[60px] text-xl font-light text-gray-700">
          <Link href="/products">Новинки</Link>
          <Link href="/products">Сумки</Link>
          <Link href="/products">Аксесуари</Link>
        </nav>

        <Link
          href="/"
          className="tracking-[0.35em] text-3xl font-regular absolute left-1/2 -translate-x-1/2"
        >
          <Image
            src="/gerdan.svg"
            alt=""
            width={214}
            height={20}
            className="object-contain"
          />
        </Link>
        <nav className="flex items-center gap-[20px]">
          <SearchDialog />

          <CartButton />
          <a className="hidden sm:block  text-[25px] font-light" href="#">
            Увійти
          </a>
        </nav>
      </div>
    </header>
  )
}
