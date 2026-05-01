'use client'

import Link from 'next/link'
import { useState, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { ACCESSORY_SUBCATEGORIES } from '@/lib/shop-taxonomy'
import { useT, useLocale } from '@/lib/i18n'

type MegaMenuLink = {
  key: string
  label: string
  href: string
  children?: Array<{ label: string; href: string }>
}

function accessorySubcategoryLabel(slug: string, ukLabel: string): string {
  const map: Record<string, string> = {
    breloky: 'Keychains',
    gerdany: 'Gerdans',
    sylyanky: 'Sylyanky',
    mitenky: 'Mittens',
    shapky: 'Beanies',
    sharfy: 'Scarves',
    rezynky: 'Hair Ties',
    chepchyky: 'Bonnets',
    'navushnyky-viazani': 'Knitted Headphones',
  }
  return map[slug] || ukLabel
}

export default function CatalogMegaMenu({
  onLinkClick,
}: {
  onLinkClick?: () => void
}) {
  const locale = useLocale()
  const t = useT()

  const DISCOVER_LINKS: Array<{ label: string; href: string }> = [
    { label: t('Всі', 'All'), href: '/shop' },
    { label: t('Sale', 'Sale'), href: '/sale' },
    { label: t('Бісер', 'Beads'), href: '/shop/group/beads' },
    { label: t('Плетіння', 'Weaving'), href: '/shop/group/weaving' },
  ]

  const CATEGORY_LINKS: MegaMenuLink[] = [
    { key: 'sumky', label: t('Сумки', 'Bags'), href: '/shop/sumky' },
    {
      key: 'bananky',
      label: t('Бананки', 'Belt Bags'),
      href: '/shop/bananky',
    },
    { key: 'shopery', label: t('Шопери', 'Shoppers'), href: '/shop/shopery' },
    { key: 'chohly', label: t('Чохли', 'Cases'), href: '/shop/chohly' },
    {
      key: 'accessories',
      label: t('Аксесуари', 'Accessories'),
      href: '/shop/accessories',
      children: ACCESSORY_SUBCATEGORIES.map((subcategory) => ({
        label:
          locale === 'en'
            ? accessorySubcategoryLabel(subcategory.slug, subcategory.label)
            : subcategory.label,
        href: `/shop/accessories/${subcategory.slug}`,
      })),
    },
  ]

  const [open, setOpen] = useState(false)
  const [activeCategoryKey, setActiveCategoryKey] = useState<string>(
    CATEGORY_LINKS[0]?.key ?? 'sumky',
  )
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
      <div className="flex items-center gap-1 text-[12px] font-medium tracking-wide">
        <Link href="/shop" onClick={handleLinkClick}>
          {t('КАТАЛОГ', 'CATALOG')}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="cursor-pointer hover:opacity-70"
          aria-label="Toggle catalog menu"
          aria-expanded={open}
          aria-haspopup="true"
        >
          <ChevronDown
            className={`w-4 h-4 cursor-pointer transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Дропдаун */}
      {open && (
        <div
          className="absolute left-0 top-[calc(100%+30px)] w-[980px] lg:px-[50px] px-6 bg-white border-b border-gray-900 p-10 grid grid-cols-3 gap-14"
          role="menu"
        >
          <div className="space-y-8">
            {DISCOVER_LINKS.map((item) => (
              <Link
                key={item.href}
                className="block hover:opacity-70 text-[12px] font-medium tracking-wide uppercase"
                href={item.href}
                onClick={handleLinkClick}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="space-y-6">
            {CATEGORY_LINKS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={clsx(
                  'block text-[12px] font-medium tracking-wide uppercase transition-colors',
                  activeCategoryKey === item.key
                    ? 'text-black underline underline-offset-4'
                    : 'text-gray-500 hover:text-black',
                )}
                onMouseEnter={() => setActiveCategoryKey(item.key)}
                onFocus={() => setActiveCategoryKey(item.key)}
                onClick={handleLinkClick}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="space-y-6">
            {(() => {
              const activeCategory = CATEGORY_LINKS.find(
                (item) => item.key === activeCategoryKey,
              )

              if (!activeCategory) {
                return null
              }

              return (
                <>
                  <Link
                    href={activeCategory.href}
                    className="block hover:opacity-70 text-[12px] font-medium tracking-wide uppercase"
                    onClick={handleLinkClick}
                  >
                    {t('Всі', 'All')}
                  </Link>
                  {activeCategory.children?.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block hover:opacity-70 text-[12px] font-medium tracking-wide uppercase"
                      onClick={handleLinkClick}
                    >
                      {child.label}
                    </Link>
                  ))}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
