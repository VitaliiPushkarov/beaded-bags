import Link from 'next/link'
import { useState, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

export default function CatalogMegaMenu() {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // щоб не «мигало», даємо невеликий геп між leave/enter
  const openMenu = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setOpen(true)
  }
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  return (
    <div
      className="relative"
      onPointerEnter={openMenu}
      onPointerLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className=" flex items-center gap-1 text-[12px] cursor-pointer hover:opacity-70 font-medium tracking-wide"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Link href="/products">КАТАЛОГ</Link>
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
              href="/products?material=Бісер"
            >
              <span className="text-[14px]/[19px] font-medium tracking-wide">
                Бісер
              </span>
            </Link>

            <Link
              className="block hover:opacity-70"
              href="/products?material=Плетіння"
            >
              <span className="text-[14px]/[19px] font-medium tracking-wide">
                Плетіння
              </span>
            </Link>

            <Link className="block hover:opacity-70" href="/products?inStock=1">
              <span className="text-[14px]/[19px] font-medium tracking-wide">
                В наявності
              </span>
            </Link>

            <Link className="block hover:opacity-70" href="/products">
              <span className="text-[14px]/[19px] font-medium tracking-wide">
                Дивитись все
              </span>
            </Link>
            <Link
              className="block hover:opacity-70"
              href="/products?type=Аксесуари"
            >
              <span className="text-[14px]/[19px] font-medium tracking-wide">
                Аксесуари
              </span>
            </Link>
          </div>

          {/* Колонка 2 (центр) */}
          <div className="space-y-8">
            <Link
              className="block hover:opacity-70 text-[14px]/[19px] font-medium tracking-wide"
              href="/products"
            >
              Сумки
            </Link>

            <Link
              className="block hover:opacity-70 text-[14px]/[19px] font-medium tracking-wide"
              href="/products?type=Всі"
            >
              Всі
            </Link>
            <Link
              className="block hover:opacity-70 text-[14px]/[19px] font-medium tracking-wide"
              href="/products?type=Бананки"
            >
              Бананки
            </Link>
            <Link
              className="block hover:opacity-70 text-[14px]/[19px] font-medium tracking-wide"
              href="/products?type=Рюкзачки"
            >
              Рюкзачки
            </Link>
            <Link
              className="block hover:opacity-70 text-[14px]/[19px] font-medium tracking-wide"
              href="/products?type=Чохли"
            >
              Чохли
            </Link>
            <Link
              className="block hover:opacity-70 text-[14px]/[19px] font-medium tracking-wide"
              href="/products?type=Шопери"
            >
              Шопери
            </Link>
          </div>

          {/* Колонка 3 (праворуч) */}
          {/* <div className="space-y-8">
            <div className="pb-4 border-b">
              <span className="text-[14px] font-medium underline underline-offset-[10px]">
                Маленькі
              </span>
            </div>

            <Link
              className="block hover:opacity-70 text-[14px]"
              href="/products?size=small"
            >
              Всі
            </Link>
            <Link
              className="block hover:opacity-70 text-[14px]"
              href="/products?size=medium"
            >
              Середні
            </Link>
            <Link
              className="block hover:opacity-70 text-[14px]"
              href="/products?size=large"
            >
              Великі
            </Link>
            <Link
              className="block hover:opacity-70 text-[14px]"
              href="/products?for=men"
            >
              Для нього
            </Link>
          </div> */}
        </div>
      )}
    </div>
  )
}
