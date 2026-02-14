import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { calcDiscountedPrice } from '@/lib/pricing'

export default function YouMayAlsoLike({
  currentSlug,
  currentId,
  currentType,
  currentGroup,
  pinnedSlugs,
  limit = 20,
}: {
  currentSlug: string
  currentId?: string
  currentType?: string
  currentGroup?: string
  pinnedSlugs?: string[]
  limit?: number
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const normalizeSlug = (s: unknown) => {
    if (!s) return ''
    const raw = String(s)
      .split('?')[0]
      .split('#')[0]
      .replace(/^\/+|\/+$/g, '')
      .trim()
    try {
      return decodeURIComponent(raw).toLowerCase()
    } catch {
      return raw.toLowerCase()
    }
  }

  const currentSlugNorm = normalizeSlug(currentSlug)
  const pinnedNorm = (pinnedSlugs ?? []).map(normalizeSlug).filter(Boolean)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        const qs = new URLSearchParams({
          lite: '1',
          limit: String(limit),
          excludeSlug: currentSlugNorm,
        })

        if (currentId) qs.set('excludeId', String(currentId))
        if (currentType) qs.set('type', String(currentType))
        if (currentGroup) qs.set('group', String(currentGroup))

        const res = await fetch(`/api/products?${qs.toString()}`, {
          cache: 'no-store',
        })
        const json = await res.json()

        // підтримка різних форматів відповіді:
        const list = Array.isArray(json)
          ? json
          : json?.items ?? json?.products ?? []

        if (!cancelled) {
          // 1) Exclude current product robustly
          const filtered = (list || []).filter((x: any) => {
            const slugNorm = normalizeSlug(x?.slug)
            if (!slugNorm) return false
            if (currentId && x?.id && String(x.id) === String(currentId))
              return false
            if (slugNorm === currentSlugNorm) return false
            return true
          })

          // 2) De-duplicate by id/slug
          const seen = new Set<string>()
          const deduped: any[] = []
          for (const x of filtered) {
            const key = String(x?.id ?? '') || normalizeSlug(x?.slug)
            if (!key) continue
            if (seen.has(key)) continue
            seen.add(key)
            deduped.push(x)
          }

          // 3) Rank: pinned first, then same type, then same group
          const score = (x: any) => {
            const slugNorm = normalizeSlug(x?.slug)
            if (pinnedNorm.length && pinnedNorm.includes(slugNorm)) return 300
            if (
              currentType &&
              x?.type &&
              String(x.type) === String(currentType)
            )
              return 200
            if (
              currentGroup &&
              x?.group &&
              String(x.group) === String(currentGroup)
            )
              return 100
            return 0
          }

          const ranked = [...deduped].sort((a, b) => {
            const d = score(b) - score(a)
            if (d !== 0) return d
            // stable-ish fallback: newest first if available
            const da = a?.createdAt ? new Date(a.createdAt).getTime() : 0
            const db = b?.createdAt ? new Date(b.createdAt).getTime() : 0
            if (db !== da) return db - da
            return String(a?.slug ?? '').localeCompare(String(b?.slug ?? ''))
          })

          // 4) If pinned provided, keep only up to limit
          setItems(ranked.slice(0, limit))
        }
      } catch (e) {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [currentSlug, currentId, currentType, currentGroup, limit, pinnedSlugs])

  const scrollByAmount = (dir: 'left' | 'right') => {
    const el = scrollerRef.current
    if (!el) return
    const amount = Math.round(el.clientWidth * 0.9)
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <h3 className="text-2xl font-semibold mb-5 uppercase">
        Вам також може сподобатись
      </h3>
      {/* arrows */}
      <button
        type="button"
        onClick={() => scrollByAmount('left')}
        className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-[#FF3D8C] hover:text-white transition cursor-pointer"
        aria-label="Prev"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => scrollByAmount('right')}
        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-[#FF3D8C] hover:text-white transition cursor-pointer"
        aria-label="Next"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* slider */}
      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {(loading ? Array.from({ length: 8 }) : items).map(
          (p: any, idx: number) => {
            if (loading) {
              return (
                <div
                  key={`sk-${idx}`}
                  className="
                  shrink-0
                  basis-[85%] sm:basis-[48%] md:basis-[32%] lg:basis-[19%]
                "
                >
                  <div className="w-full aspect-4/5 bg-gray-100 animate-pulse border" />
                  <div className="mt-2 h-4 w-2/3 bg-gray-100 animate-pulse" />
                  <div className="mt-1 h-4 w-1/3 bg-gray-100 animate-pulse" />
                </div>
              )
            }

            const href = `/products/${p.slug}`

            const image =
              p?.image ||
              p?.mainImage ||
              p?.variants?.[0]?.image ||
              p?.variants?.[0]?.images?.[0]?.url ||
              '/img/placeholder.png'

            const firstVariant = p?.variants?.[0]
            const hasAnyPrice =
              typeof firstVariant?.priceUAH === 'number' ||
              typeof p?.basePriceUAH === 'number' ||
              typeof p?.priceUAH === 'number'
            const { basePriceUAH, finalPriceUAH, hasDiscount, discountPercent } =
              calcDiscountedPrice({
                basePriceUAH:
                  firstVariant?.priceUAH ?? p?.basePriceUAH ?? p?.priceUAH ?? 0,
                discountPercent: firstVariant?.discountPercent,
                discountUAH: firstVariant?.discountUAH ?? 0,
              })

            return (
              <div
                key={p.id ?? p.slug ?? idx}
                className="
                shrink-0
                basis-[85%] sm:basis-[48%] md:basis-[32%] lg:basis-[19%]
              "
              >
                <Link href={href} className="block">
                  <div className="relative w-full aspect-4/5 border bg-white overflow-hidden">
                    <Image
                      src={image}
                      alt={p?.name ?? 'Product'}
                      fill
                      className="object-cover"
                      sizes="(min-width: 1024px) 20vw, (min-width: 640px) 45vw, 85vw"
                      loading="lazy"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-sm text-gray-900 truncate">
                      {p?.name}
                    </div>
                    {hasAnyPrice && (
                      <div className="text-sm text-gray-900 whitespace-nowrap flex items-baseline gap-1.5">
                        <span>{finalPriceUAH.toLocaleString('uk-UA')} ₴</span>
                        {hasDiscount && (
                          <>
                            <span className="text-xs text-gray-500 line-through">
                              {basePriceUAH.toLocaleString('uk-UA')} ₴
                            </span>
                            <span className="text-[10px] border border-black rounded-full px-1.5 py-0.5 self-center">
                              -{discountPercent}%
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              </div>
            )
          }
        )}
      </div>
    </div>
  )
}
