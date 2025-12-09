'use client'

import Link from 'next/link'
import { useState, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
/* import { ProductType } from '@prisma/client' */

/* const CATEGORIES: ProductType[] = [
  'BAG',
  'BELT_BAG',
  'BACKPACK',
  'SHOPPER',
  'CASE',
] */

export default function CatalogMegaMenu({
  onLinkClick,
}: {
  onLinkClick?: () => void
}) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openMenu = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setOpen(true)
  }
  const closeMenu = () => {
    setOpen(false)
  }

  const handleLinkClick = () => {
    closeMenu()
    if (onLinkClick) {
      onLinkClick()
    }
  }

  const scheduleCloseMenu = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
    }
    closeTimer.current = setTimeout(() => {
      setOpen(false)
    }, 200)
  }

  return (
    <div
      className="relative"
      onPointerEnter={openMenu}
      onPointerLeave={scheduleCloseMenu}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className=" flex items-center gap-1 text-[12px] cursor-pointer hover:opacity-70 font-medium tracking-wide"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Link href="/shop" onClick={handleLinkClick}>
          КАТАЛОГ
        </Link>
        <ChevronDown
          className={`w-4 h-4 cursor-pointer transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Дропдаун */}
      {open && (
        <div
          className="absolute left-0 top-[calc(100%+30px)] w-[920px] lg:px-[50px] px-6 bg-white border-b border-gray-900 p-10 grid grid-cols-2 gap-14"
          role="menu"
        >
          {/* Колонка 1 (ліворуч) */}
          <div className="space-y-8">
            <Link
              className="block hover:opacity-70"
              href="/shop?group=Бісер"
              onClick={handleLinkClick}
            >
              <span
                className="text-[12px] font-medium tracking-wide  uppercase
              "
              >
                Бісер
              </span>
            </Link>

            <Link
              className="block hover:opacity-70"
              href="/shop?group=Плетіння"
              onClick={handleLinkClick}
            >
              <span
                className="text-[12px] font-medium tracking-wide uppercase
              "
              >
                Плетіння
              </span>
            </Link>

            <Link
              className="block hover:opacity-70"
              href="/shop?inStock=1"
              onClick={handleLinkClick}
            >
              <span
                className="text-[12px] font-medium tracking-wide uppercase
              "
              >
                В наявності
              </span>
            </Link>
            <Link
              className="block hover:opacity-70"
              href="/shop/accessories"
              onClick={handleLinkClick}
            >
              <span
                className="text-[12px] font-medium tracking-wide uppercase
              "
              >
                Аксесуари
              </span>
            </Link>
          </div>

          {/* Колонка 2 (центр) */}
          <div className="space-y-8">
            <Link
              href="/shop/sumky"
              className="block hover:opacity-70 text-[12px] font-medium tracking-wide uppercase"
              onClick={handleLinkClick}
            >
              СУМКИ
            </Link>
            <Link
              href="/shop/bananky"
              className="block hover:opacity-70 text-[12px] font-medium tracking-wide uppercase"
              onClick={handleLinkClick}
            >
              БАНАНКИ
            </Link>
            <Link
              href="/shop/rjukzachky"
              className="block hover:opacity-70 text-[12px] font-medium tracking-wide uppercase"
              onClick={handleLinkClick}
            >
              РЮКЗАЧКИ
            </Link>
            <Link
              href="/shop/shopery"
              className="block hover:opacity-70 text-[12px] font-medium tracking-wide uppercase"
              onClick={handleLinkClick}
            >
              ШОПЕРИ
            </Link>
            <Link
              href="/shop/chohly"
              className="block hover:opacity-70 text-[12px] font-medium tracking-wide uppercase"
              onClick={handleLinkClick}
            >
              ЧОХЛИ
            </Link>
            <Link
              href="/shop/prykrasy"
              className="block hover:opacity-70 text-[12px] font-medium tracking-wide uppercase"
              onClick={handleLinkClick}
            >
              ПРИКРАСИ
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
