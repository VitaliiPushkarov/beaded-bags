'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import SearchIcon from '@/components/icons/Search'
import { useLocale, useLocaleNumberFormat, useT } from '@/lib/i18n'
import {
  formatLocalizedMoney,
  pickLocalizedMoney,
  pickLocalizedText,
} from '@/lib/localized-product'

type SearchProduct = {
  id: string
  slug: string
  name: string
  nameEn?: string | null
  basePriceUAH?: number | null
  basePriceUSD?: number | null
  variants?: {
    image?: string | null
    priceUAH?: number | null
    priceUSD?: number | null
    images?: { url?: string | null }[]
  }[]
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getProductImage(p: SearchProduct): string {
  return (
    p.variants?.[0]?.image ||
    p.variants?.[0]?.images?.[0]?.url ||
    '/img/placeholder.png'
  )
}

export default function SearchDialog() {
  const locale = useLocale()
  const t = useT()
  const numberLocale = useLocaleNumberFormat()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchProduct[]>([])
  const [matchesCount, setMatchesCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const cacheRef = useRef<Map<string, { items: SearchProduct[]; total: number }>>(
    new Map(),
  )
  const inputRef = useRef<HTMLInputElement>(null)

  // Search by query only when dialog is open
  useEffect(() => {
    if (!open) return

    const query = q.trim()
    if (!query) {
      setLoading(false)
      setResults([])
      setMatchesCount(0)
      return
    }

    const cacheKey = normalize(query)
    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      setResults(cached.items)
      setMatchesCount(cached.total)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timerId = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/products?search=${encodeURIComponent(query)}&limit=50`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        if (!res.ok) throw new Error('Failed to search')

        const data = await res.json()
        const items = Array.isArray(data) ? data : data?.items ?? []
        const total =
          typeof data?.total === 'number' ? data.total : items.length

        cacheRef.current.set(cacheKey, { items, total })
        if (!controller.signal.aborted) {
          setResults(items)
          setMatchesCount(total)
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([])
          setMatchesCount(0)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 180)

    return () => {
      clearTimeout(timerId)
      controller.abort()
    }
  }, [open, q])

  // keyboard: "/" to open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const typing =
        tag === 'INPUT' || tag === 'TEXTAREA' || e.isComposing === true
      if (!typing && e.key === '/') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (open && e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // focus input immediately on open (without click delay)
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  // lock body scroll while dialog is open (fast, mobile-friendly)
  useEffect(() => {
    if (!open) return

    const body = document.body
    const prevOverflow = body.style.overflow
    body.style.overflow = 'hidden'

    return () => {
      body.style.overflow = prevOverflow
    }
  }, [open])

  const visibleResults = useMemo(() => {
    const maxDefault = 10
    const maxMobile = 8
    const max = showAll ? 50 : maxDefault

    // We'll show fewer on mobile, but only when not expanded.
    const isMobile =
      typeof window !== 'undefined'
        ? window.matchMedia('(max-width: 1023px)').matches
        : false

    const sliceTo = !showAll && isMobile ? maxMobile : max

    return results.slice(0, sliceTo)
  }, [results, showAll])

  const canShowAllMobile =
    q.trim() && !showAll && matchesCount > visibleResults.length

  return (
    <>
      {/* trigger */}
      <button
        aria-label={t('Пошук (/)', 'Search (/)')}
        onClick={() => {
          setShowAll(false)
          setOpen(true)
        }}
        className="inline-flex h-8 w-8 items-center justify-center cursor-pointer"
      >
        <SearchIcon />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => {
                setOpen(false)
                setShowAll(false)
              }}
            />
            <div
              className="
                absolute inset-0 bg-white flex flex-col
                lg:inset-auto lg:left-1/2 lg:top-16 lg:w-[92vw] lg:max-w-xl lg:-translate-x-1/2
                lg:rounded-xl lg:shadow-xl
              "
            >
              <div className="flex items-center gap-2 border-b px-4">
                <SearchIcon />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value)
                    setShowAll(false)
                  }}
                  placeholder={t('Пошук товарів…', 'Search products...')}
                  className="flex-1 py-3 outline-none placeholder:text-gray-400"
                />
                <button
                  onClick={() => {
                    setOpen(false)
                    setShowAll(false)
                  }}
                  aria-label={t('Закрити пошук', 'Close search')}
                  className="ml-2 text-xl font-light leading-none cursor-pointer "
                >
                  <span className="text-2xl leading-none">&times;</span>
                </button>
              </div>

              <ul className="flex-1 min-h-0 overflow-auto divide-y lg:max-h-80">
                {q && loading && (
                  <li className="p-4 text-sm text-gray-500">
                    {t('Пошук…', 'Searching...')}
                  </li>
                )}
                {q && !loading && visibleResults.length === 0 && (
                  <li className="p-4 text-sm text-gray-500">
                    {t('Нічого не знайдено', 'No results found')}
                  </li>
                )}
                {visibleResults.map((p) => (
                  <li key={p.id} className="hover:bg-gray-50">
                    {(() => {
                      const title = pickLocalizedText(p.name, p.nameEn, locale)
                      const money = pickLocalizedMoney({
                        locale,
                        priceUAH:
                          p.variants?.[0]?.priceUAH ??
                          p.basePriceUAH ??
                          null,
                        priceUSD:
                          p.variants?.[0]?.priceUSD ??
                          p.basePriceUSD ??
                          null,
                      })
                      const hasAnyPrice =
                        typeof p.variants?.[0]?.priceUAH === 'number' ||
                        typeof p.variants?.[0]?.priceUSD === 'number' ||
                        typeof p.basePriceUAH === 'number' ||
                        typeof p.basePriceUSD === 'number'

                      return (
                    <Link
                      href={`/products/${p.slug}`}
                      onClick={() => {
                        setOpen(false)
                        setShowAll(false)
                      }}
                      className="flex items-center gap-3 p-3"
                    >
                      <div
                        className="w-12 h-12 rounded bg-gray-100 overflow-hidden shrink-0"
                        style={{
                          backgroundImage: `url(${getProductImage(p)})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      />
                      <div className="flex-1">
                        <div className="text-sm">{title}</div>
                        {hasAnyPrice ? (
                          <div className="text-xs text-gray-500">
                            {formatLocalizedMoney(
                              money.amount,
                              money.currency,
                              numberLocale,
                            )}
                          </div>
                        ) : null}
                      </div>
                    </Link>
                      )
                    })()}
                  </li>
                ))}
                {canShowAllMobile && (
                  <div className="lg:hidden px-4 py-3 pt-5">
                    <button
                      type="button"
                      onClick={() => setShowAll(true)}
                      className="w-full h-11 border border-black bg-white text-black text-sm font-medium hover:bg-black hover:text-white transition"
                    >
                      {t('Показати всі', 'Show all')} ({matchesCount})
                    </button>
                  </div>
                )}
              </ul>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
