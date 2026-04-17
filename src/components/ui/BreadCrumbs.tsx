'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { getTypeLabel } from '@/lib/labels'
import type { ProductType } from '@prisma/client'
import { useLocale } from '@/lib/i18n'

type Crumb = { label: string; href?: string }
const SITE_URL = 'https://gerdan.online'

const nice = (s: string) =>
  decodeURIComponent(s)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())

/** Мапа підписів для поширених роутів/фільтрів */
const LABELS_UK: Record<string, string> = {
  shop: 'Каталог',
  sumky: 'Сумки',
  bananky: 'Бананки',
  rjukzachky: 'Рюкзачки',
  shopery: 'Шопери',
  chohly: 'Чохли',
  prykrasy: 'Прикраси',
  accessories: 'Аксесуари',
  breloky: 'Брелоки',
  gerdany: 'Гердани',
  sylyanky: 'Силянки',
  mitenky: 'Мітенки',
  'navushnyky-viazani': "Навушники в'язані",
  sharfy: 'Шарфи',
  rezynky: 'Резинки',
  shapky: 'Шапки',
  chepchyky: 'Чепчики',
  about: 'Про нас',
  info: 'Інформація',
  checkout: 'Оформлення',
  success: 'Успішна оплата',
  pay: 'Оплата',
  oferta: 'Публічна оферта',
  policy: 'Політика конфіденційності',
  cashback: 'Обмін та повернення',
  contacts: 'Контакти',
  blog: 'Блог',
}

const LABELS_EN: Record<string, string> = {
  shop: 'Catalog',
  sumky: 'Bags',
  bananky: 'Belt Bags',
  rjukzachky: 'Backpacks',
  shopery: 'Shoppers',
  chohly: 'Cases',
  prykrasy: 'Accessories',
  accessories: 'Accessories',
  breloky: 'Keychains',
  gerdany: 'Gerdans',
  sylyanky: 'Sylyanky',
  mitenky: 'Mittens',
  'navushnyky-viazani': 'Knitted Headphones',
  sharfy: 'Scarves',
  rezynky: 'Hair Ties',
  shapky: 'Beanies',
  chepchyky: 'Bonnets',
  about: 'About',
  info: 'Info',
  checkout: 'Checkout',
  success: 'Success',
  pay: 'Payment',
  oferta: 'Public offer',
  policy: 'Privacy policy',
  cashback: 'Returns & exchange',
  contacts: 'Contacts',
  blog: 'Blog',
}

function typeLabel(t?: string | null, locale: 'uk' | 'en' = 'uk') {
  if (!t) return ''
  const asEnum = (t.toUpperCase?.() ?? t) as ProductType
  return getTypeLabel(asEnum, locale) || nice(t)
}

import { Suspense } from 'react'

export default function Breadcrumbs(props: { override?: Crumb[] }) {
  return (
    <Suspense fallback={null}>
      <BreadcrumbsInner {...props} />
    </Suspense>
  )
}

function BreadcrumbsInner({ override }: { override?: Crumb[] }) {
  const locale = useLocale()
  const labels = locale === 'en' ? LABELS_EN : LABELS_UK
  const pathname = usePathname()
  const sp = useSearchParams()

  const crumbs = useMemo<Crumb[]>(() => {
    if (override) return override

    const parts = (pathname || '/').split('/').filter(Boolean)
    const acc: Crumb[] = [{ label: locale === 'en' ? 'Home' : 'Головна', href: '/' }]

    let href = ''
    parts.forEach((p, idx) => {
      href += `/${p}`
      const isLast = idx === parts.length - 1
      const baseLabel = labels[p] || nice(p)

      // спец-випадок: сторінка каталогу з фільтрами (?type=… & group=… & color=…)
      if (p === 'products') {
        const type = sp.get('type')
        const group = sp.get('group')
        const color = sp.get('color')
        const list: Crumb[] = [{ label: baseLabel, href }]

        if (group) {
          list.push({
            label: `${locale === 'en' ? 'Group' : 'Група'}: ${nice(group)}`,
            href: `/products?group=${encodeURIComponent(group)}`,
          })
        }
        if (type) {
          list.push({
            label: `${locale === 'en' ? 'Type' : 'Тип'}: ${typeLabel(type, locale)}`,
          })
        }
        if (color) {
          list.push({
            label: `${locale === 'en' ? 'Color' : 'Колір'}: ${nice(color)}`,
          })
        }
        return acc.push(...list)
      }

      // звичайний сегмент
      acc.push({ label: baseLabel, href: isLast ? undefined : href })
    })

    return acc
  }, [pathname, sp, override, locale, labels])

  const jsonLd = useMemo(() => {
    if (crumbs.length <= 1) return null
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.label,
        item: `${SITE_URL}${crumb.href ?? pathname ?? '/'}`,
      })),
    }
  }, [crumbs, pathname])

  if (crumbs.length <= 1) return null

  return (
    <>
      <nav
        aria-label={locale === 'en' ? 'Breadcrumbs' : 'Хлібні крихти'}
        className="mb-5 md:mb-10"
      >
        <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1
            return (
              <li key={`${c.label}-${i}`} className="flex items-center gap-2">
                {c.href && !last ? (
                  <Link
                    href={c.href}
                    className="hover:text-black underline underline-offset-2"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-gray-900">{c.label}</span>
                )}
                {!last && <span aria-hidden>›</span>}
              </li>
            )
          })}
        </ol>
      </nav>

      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </>
  )
}
