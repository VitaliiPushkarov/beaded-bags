'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useMemo, Suspense } from 'react'

type Crumb = { label: string; href?: string }

const nice = (s: string) =>
  decodeURIComponent(s)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())

/** Мапа підписів для поширених роутів/фільтрів */
const LABELS: Record<string, string> = {
  products: 'Каталог',
  cart: 'Кошик',
  checkout: 'Оформлення',
  success: 'Успіх',
  login: 'Увійти',
}

export default function Breadcrumbs({ override }: { override?: Crumb[] }) {
  const pathname = usePathname()
  const sp = useSearchParams()

  const crumbs = useMemo<Crumb[]>(() => {
    if (override) return override

    const parts = (pathname || '/').split('/').filter(Boolean)
    const acc: Crumb[] = [{ label: 'Головна', href: '/' }]

    let href = ''
    parts.forEach((p, idx) => {
      href += `/${p}`
      const isLast = idx === parts.length - 1
      const baseLabel = LABELS[p] || nice(p)

      // спец-випадок: сторінка каталогу з фільтрами (?type=… & group=…)
      if (p === 'products') {
        const type = sp.get('type')
        const group = sp.get('group') // якщо маєш такий параметр
        const list: Crumb[] = [{ label: baseLabel, href }]

        if (group)
          list.push({
            label: `Група: ${group}`,
            href: `/products?group=${encodeURIComponent(group)}`,
          })
        if (type) list.push({ label: `Тип: ${type}` }) // останній без href
        return acc.push(...list)
      }

      // звичайний сегмент
      acc.push({ label: baseLabel, href: isLast ? undefined : href })
    })

    return acc
  }, [pathname, sp, override])

  if (crumbs.length <= 1) return null

  const jsonLd = useMemo(() => {
    if (typeof window === 'undefined') return null
    const origin = window.location.origin

    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.label,
        item: c.href
          ? new URL(c.href, origin).toString()
          : window.location.href,
      })),
    }
  }, [crumbs])
  return (
    <Suspense fallback={null}>
      <>
        <nav aria-label="Хлібні крихти" className="mb-10">
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
        {/* JSON-LD для SEO */}
        {jsonLd && (
          <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        )}
      </>
    </Suspense>
  )
}
