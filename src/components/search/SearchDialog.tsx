'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import SearchIcon from '@/components/icons/Search'
import { PRODUCTS, type Product } from '@/lib/products'

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
}

export default function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // keyboard: "/" to open (except when typing in inputs)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const typing =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e as any).isComposing
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

  const results = useMemo(() => {
    if (!q.trim()) return []
    const nq = normalize(q)
    return PRODUCTS.map((p) => ({ p, score: scoreProduct(p, nq) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((x) => x.p)
  }, [q])

  return (
    <>
      {/* trigger */}
      <button
        aria-label="Пошук (/)"
        onClick={() => {
          setOpen(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className="inline-flex h-8 w-8 items-center justify-center cursor-pointer"
      >
        <SearchIcon className="h-5 w-5 fill-current text-gray-900" />
      </button>

      {/* dialog */}
      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-1/2 top-16 w-[92vw] max-w-xl -translate-x-1/2 rounded-xl bg-white shadow-xl">
            <div className="flex items-center gap-2 border-b px-3">
              <SearchIcon className="h-4 w-4 text-gray-500" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Пошук товарів… (натисни / )"
                className="flex-1 py-3 outline-none placeholder:text-gray-400"
              />
              <button
                onClick={() => setOpen(false)}
                className="text-sm text-gray-500 py-3"
              >
                Esc
              </button>
            </div>

            <ul className="max-h-80 overflow-auto divide-y">
              {q && results.length === 0 && (
                <li className="p-4 text-sm text-gray-500">
                  Нічого не знайдено
                </li>
              )}
              {results.map((p: Product) => (
                <li key={p.id} className="hover:bg-gray-50">
                  <Link
                    href={`/products/${p.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 p-3"
                  >
                    {/* міні-прев’ю без <Image>, щоб не ускладнювати діалог */}
                    <div
                      className="w-12 h-12 rounded bg-gray-100 overflow-hidden shrink-0"
                      style={{
                        backgroundImage: `url(${p.images[0]})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                    <div className="flex-1">
                      <div className="text-sm">{p.name}</div>
                      <div className="text-xs text-gray-500">
                        {p.basePriceUAH} грн
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-500">
              <span>Підказка: натисни «/» щоб швидко відкрити пошук</span>
              <span>{results.length} результатів</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function scoreProduct(p: Product, nq: string) {
  const hay = normalize(`${p.name} ${p.description ?? ''} ${p.color ?? ''}`)
  if (!nq) return 0
  if (hay.includes(nq)) return 100 - hay.indexOf(nq) // просте ранжування
  // розбий за пробілами (AND)
  const terms = nq.split(/\s+/).filter(Boolean)
  const hitCount = terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0)
  return hitCount > 0 ? 10 + hitCount : 0
}
