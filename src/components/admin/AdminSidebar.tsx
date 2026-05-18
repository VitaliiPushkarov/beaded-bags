'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import {
  BarChart3,
  Boxes,
  Calculator,
  ChevronDown,
  FileText,
  Factory,
  Home,
  Package,
  Settings2,
  ShoppingCart,
  UserRound,
  Wallet,
} from 'lucide-react'

type AdminNavLinkItem = {
  kind: 'link'
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}

type AdminNavGroupItem = {
  kind: 'group'
  baseHref: string
  label: string
  icon: ComponentType<{ className?: string }>
  children: Array<{
    href: string
    label: string
  }>
}

type AdminNavItem = AdminNavLinkItem | AdminNavGroupItem

const NAV_ITEMS: AdminNavItem[] = [
  { kind: 'link', href: '/admin', label: 'Огляд', icon: Home },
  { kind: 'link', href: '/admin/products', label: 'Товари', icon: Package },
  {
    kind: 'link',
    href: '/admin/orders',
    label: 'Замовлення',
    icon: ShoppingCart,
  },
  {
    kind: 'link',
    href: '/admin/costs',
    label: 'Собівартість',
    icon: Calculator,
  },
  {
    kind: 'group',
    baseHref: '/admin/inventory',
    label: 'Запаси',
    icon: Boxes,
    children: [
      { href: '/admin/inventory', label: 'Огляд' },
      { href: '/admin/inventory/products', label: 'Товари' },
      { href: '/admin/inventory/packaging', label: 'Пакування' },
      { href: '/admin/inventory/materials', label: 'Матеріали' },
    ],
  },
  { kind: 'link', href: '/admin/expenses', label: 'Витрати', icon: Wallet },
  { kind: 'link', href: '/admin/artisans', label: 'Майстри', icon: UserRound },
  {
    kind: 'link',
    href: '/admin/production',
    label: 'Виробництво',
    icon: Factory,
  },
  { kind: 'link', href: '/admin/finance', label: 'Фінанси', icon: BarChart3 },
  {
    kind: 'link',
    href: '/admin/configuration',
    label: 'Конфігурація',
    icon: Settings2,
  },
  { kind: 'link', href: '/admin/blog', label: 'Блог', icon: FileText },
]

function isItemActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isInventoryChildActive(pathname: string, href: string) {
  if (href === '/admin/inventory') {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminSidebar() {
  const pathname = usePathname()
  const inventoryRouteActive = isItemActive(pathname, '/admin/inventory')
  const [inventoryOpen, setInventoryOpen] = useState(inventoryRouteActive)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (inventoryRouteActive) {
      setInventoryOpen(true)
    }
  }, [inventoryRouteActive])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <aside className="admin-sidebar">
      <div className="flex h-16 items-center justify-between border-b border-slate-200/80 p-4">
        <Link href="/admin" className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            GERDAN Admin
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 md:hidden"
          aria-expanded={mobileOpen}
          aria-controls="admin-mobile-nav"
        >
          {mobileOpen ? 'Закрити' : 'Меню'}
        </button>
      </div>

      <nav
        id="admin-mobile-nav"
        className={clsx('space-y-1 p-2', mobileOpen ? 'block' : 'hidden md:block')}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon

          if (item.kind === 'group') {
            const groupActive = isItemActive(pathname, item.baseHref)

            return (
              <div key={item.baseHref}>
                <button
                  type="button"
                  onClick={() => setInventoryOpen((current) => !current)}
                  className={clsx(
                    'admin-nav-item w-full justify-between',
                    groupActive && 'admin-nav-item-active',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  <ChevronDown
                    className={clsx(
                      'h-4 w-4 shrink-0 transition-transform',
                      inventoryOpen && 'rotate-180',
                    )}
                  />
                </button>

                {inventoryOpen ? (
                  <div className="mt-1 space-y-1 pl-8">
                    {item.children.map((child) => {
                      const childActive = isInventoryChildActive(
                        pathname,
                        child.href,
                      )
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={clsx(
                            'flex rounded-md px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900',
                            childActive &&
                              'bg-slate-900 text-white hover:bg-slate-900 hover:text-white',
                          )}
                        >
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          }

          const active = isItemActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'admin-nav-item',
                active && 'admin-nav-item-active',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div
        className={clsx(
          'mt-auto border-t border-slate-200/80 p-3',
          mobileOpen ? 'block' : 'hidden md:block',
        )}
      >
        <Link href="/" className="admin-nav-item justify-center">
          На сайт
        </Link>
      </div>
    </aside>
  )
}
