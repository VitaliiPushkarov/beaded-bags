'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import SearchIcon from '@/components/icons/Search'

type SearchProduct = {
  id: string
  slug: string
  name: string
  description?: string | null
  basePriceUAH?: number | null
  color?: string | null
  images?: string[] | null
  image?: string | null
  mainImage?: string | null
  variants?: { image?: string | null }[]
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getProductImage(p: SearchProduct): string {
  return (
    p.mainImage ||
    p.image ||
    (Array.isArray(p.images) && p.images[0]) ||
    (Array.isArray(p.variants) && p.variants[0]?.image) ||
    '/img/placeholder.png'
  )
}

export default function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [products, setProducts] = useState<SearchProduct[]>([])
  const [showAll, setShowAll] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // тягнемо з Prisma через наш API
  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data: SearchProduct[]) => setProducts(data))
      .catch(() => setProducts([]))
  }, [])

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

  const { results, matchesCount } = useMemo(() => {
    if (!q.trim()) return { results: [] as SearchProduct[], matchesCount: 0 }
    const nq = normalize(q)

    const scored = products
      .map((p) => ({ p, score: scoreProduct(p, nq) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)

    const maxDefault = 10
    const maxMobile = 8
    const max = showAll ? 50 : maxDefault

    // We'll show fewer on mobile, but only when not expanded.
    const isMobile =
      typeof window !== 'undefined'
        ? window.matchMedia('(max-width: 1023px)').matches
        : false

    const sliceTo = !showAll && isMobile ? maxMobile : max

    return {
      results: scored.slice(0, sliceTo).map((x) => x.p),
      matchesCount: scored.length,
    }
  }, [q, products, showAll])

  const canShowAllMobile = q.trim() && !showAll && matchesCount > results.length

  return (
    <>
      {/* trigger */}
      <button
        aria-label="Пошук (/)"
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
                  placeholder="Пошук товарів…"
                  className="flex-1 py-3 outline-none placeholder:text-gray-400"
                />
                <button
                  onClick={() => {
                    setOpen(false)
                    setShowAll(false)
                  }}
                  aria-label="Закрити пошук"
                  className="ml-2 text-xl font-light leading-none cursor-pointer "
                >
                  <span className="text-2xl leading-none">&times;</span>
                </button>
              </div>

              <ul className="flex-1 min-h-0 overflow-auto divide-y lg:max-h-80">
                {q && results.length === 0 && (
                  <li className="p-4 text-sm text-gray-500">
                    Нічого не знайдено
                  </li>
                )}
                {results.map((p) => (
                  <li key={p.id} className="hover:bg-gray-50">
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
                        <div className="text-sm">{p.name}</div>
                        {typeof p.basePriceUAH === 'number' ? (
                          <div className="text-xs text-gray-500">
                            {p.basePriceUAH.toLocaleString('uk-UA')} ₴
                          </div>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
                {canShowAllMobile && (
                  <div className="lg:hidden px-4 py-3 pt-5">
                    <button
                      type="button"
                      onClick={() => setShowAll(true)}
                      className="w-full h-11 border border-black bg-white text-black text-sm font-medium hover:bg-black hover:text-white transition"
                    >
                      Показати всі ({matchesCount})
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

function scoreProduct(p: SearchProduct, nq: string) {
  const hay = normalize(
    `${p.name} ${p.description ?? ''} ${p.color ?? ''}`.trim()
  )
  if (!nq) return 0
  if (hay.includes(nq)) return 100 - hay.indexOf(nq)
  const terms = nq.split(/\s+/).filter(Boolean)
  const hitCount = terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0)
  return hitCount > 0 ? 10 + hitCount : 0
}
