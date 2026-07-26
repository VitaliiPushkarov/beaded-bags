import Link from 'next/link'

import { totalPageCount } from '@/lib/admin-pagination'

type Props = {
  page: number
  pageSize: number
  totalCount: number
  // Builds the href for a given page number, preserving other query params.
  buildHref: (page: number) => string
}

export default function AdminPagination({
  page,
  pageSize,
  totalCount,
  buildHref,
}: Props) {
  if (totalCount <= pageSize) return null

  const pages = totalPageCount(totalCount, pageSize)
  const current = Math.min(Math.max(1, page), pages)
  const from = (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, totalCount)

  const linkClass =
    'inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm transition hover:border-black'
  const disabledClass =
    'inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm text-slate-300'

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm text-slate-600"
      aria-label="Пагінація"
    >
      <span>
        {from}–{to} з {totalCount}
      </span>
      <div className="flex items-center gap-2">
        {current > 1 ? (
          <Link href={buildHref(current - 1)} className={linkClass} rel="prev">
            Назад
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled>
            Назад
          </span>
        )}
        <span className="px-1">
          Стор. {current} / {pages}
        </span>
        {current < pages ? (
          <Link href={buildHref(current + 1)} className={linkClass} rel="next">
            Далі
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled>
            Далі
          </span>
        )}
      </div>
    </nav>
  )
}
