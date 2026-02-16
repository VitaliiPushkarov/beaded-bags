'use client'
import Link from 'next/link'
import Image from 'next/image'
/* import { useCart } from '@/app/store/cart' */
import SearchDialog from './search/SearchDialog'
import CartButton from './CartButton'
import { useState, useEffect } from 'react'
import CatalogMenu from './CatalogMenu'
import { usePathname } from 'next/navigation'

export default function Header() {
  /* const { items } = useCart() */
  /* const count = items.reduce((s, i) => s + i.qty, 0) */

  const [borderColor, setBorderColor] = useState('white')
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 80) {
        // Define your scroll threshold
        setBorderColor('#d9d9d9')
      } else {
        setBorderColor('white')
      }
    }

    window.addEventListener('scroll', handleScroll)

    // Clean up the event listener on component unmount
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobileMenu = () => setMobileOpen(false)

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    if (mobileOpen) document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [mobileOpen])
  const pathname = usePathname()
  useEffect(() => {
    // Закриваємо мобільне меню при зміні шляху
    setMobileOpen(false)
  }, [pathname])
  return (
    <>
      <header
        className="sticky top-0 z-50 bg-white"
        style={{
          borderBottom: `1px solid ${borderColor}`,
          transition: 'border-color 0.3s ease',
        }}
      >
        <div className="px-4 sm:px-6 lg:px-[50px] py-3 flex items-center justify-between lg:gap-[130px] lg:h-[86px] relative">
          {/* Mobile hamburger button */}
          <button
            aria-controls="mobile-menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            aria-label="Toggle menu"
          >
            <svg
              className="h-6 w-6"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>

          {/* Left nav desktop */}
          <nav className="hidden lg:flex items-center gap-12">
            <CatalogMenu />
          </nav>

          {/* Center logo */}
          <Link
            href="/"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <Image
              src="/gerdan.svg"
              alt="website logo"
              width={214}
              height={20}
              className="object-contain"
            />
          </Link>

          {/* Right nav */}
          <nav className="flex items-center md:gap-5 gap-1">
            <Link
              href="/info"
              className="hidden lg:inline-block hover:opacity-70 text-[12px] font-medium tracking-wide"
            >
              ІНФО
            </Link>
            <Link
              href="/about"
              className="hidden lg:inline-block hover:opacity-70 text-[12px] font-medium tracking-wide"
            >
              ПРО НАС
            </Link>
            <Link
              href="/contacts"
              className="hidden lg:inline-block hover:opacity-70 text-[12px] font-medium tracking-wide"
            >
              КОНТАКТИ
            </Link>
            <Link
              href="/blog"
              className="hidden lg:inline-block hover:opacity-70 text-[12px] font-medium tracking-wide"
            >
              БЛОГ
            </Link>
            <SearchDialog />
            <CartButton />
            {/* <a
              className="hidden lg:block text-[12px] cursor-pointer hover:opacity-70 font-medium tracking-wide"
              href="/login"
            >
              УВІЙТИ
            </a> */}
          </nav>
        </div>
      </header>

      {/* Mobile menu drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            className="fixed left-0 top-0 w-90 h-full bg-white p-6 overflow-y-auto z-50"
          >
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-4 text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            >
              <svg
                className="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <ul className="flex flex-col gap-1 text-[14px] text-lg">
              <li className="font-semibold uppercase tracking-wider  mb-6">
                Меню
              </li>
              <li className="font-medium border-b py-4 border-gray-300">
                <Link href="/shop" onClick={closeMobileMenu}>
                  Всі товари
                </Link>
              </li>

              <li className="border-b py-4 border-gray-300">
                <Link href="/shop/sumky" onClick={closeMobileMenu}>
                  Сумки
                </Link>
              </li>
              <li className="border-b py-4 border-gray-300">
                <Link href="/shop/bananky" onClick={closeMobileMenu}>
                  Бананки
                </Link>
              </li>
              {/* <li className="border-b py-4 border-gray-300">
                <Link href="/shop/rjukzachky" onClick={closeMobileMenu}>
                  Рюкзачки
                </Link>
              </li> */}
              <li className="border-b py-4 border-gray-300">
                <Link href="/shop/chohly" onClick={closeMobileMenu}>
                  Чохли
                </Link>
              </li>
              <li className="border-b py-4 border-gray-300">
                <Link href="/shop/shopery" onClick={closeMobileMenu}>
                  Шопери
                </Link>
              </li>

              <li className="border-b py-4 border-gray-300">
                <Link href="/shop/group/beads" onClick={closeMobileMenu}>
                  Бісер
                </Link>
              </li>
              <li className="border-b py-4 border-gray-300">
                <Link href="/shop/group/beads" onClick={closeMobileMenu}>
                  Прикраси
                </Link>
              </li>
              <li className="border-b py-4 border-gray-300">
                <Link href="/shop/group/weaving" onClick={closeMobileMenu}>
                  Плетіння
                </Link>
              </li>
              <li className="border-b py-4 border-gray-300">
                <Link href="/shop/accessories" onClick={closeMobileMenu}>
                  Аксесуари
                </Link>
              </li>
              <li className=" border-b py-4 border-gray-300">
                <Link href="/info" onClick={closeMobileMenu}>
                  Інфо
                </Link>
              </li>
              <li className="border-b py-4 border-gray-300">
                <Link href="/about" onClick={closeMobileMenu}>
                  Про нас
                </Link>
              </li>
              <li className="border-b py-4 border-gray-300">
                <Link href="/contacts" onClick={closeMobileMenu}>
                  Контакти
                </Link>
              </li>
              <li className="border-b py-4 border-gray-300">
                <Link href="/blog" onClick={closeMobileMenu}>
                  Блог
                </Link>
              </li>
            </ul>
          </aside>
        </>
      )}
    </>
  )
}
