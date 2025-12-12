import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function YouMayAlsoLike({
  currentSlug,
}: {
  currentSlug: string
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        const res = await fetch('/api/products', { cache: 'no-store' })
        const json = await res.json()

        // підтримка різних форматів відповіді:
        const list = Array.isArray(json)
          ? json
          : json?.items ?? json?.products ?? []

        if (!cancelled) {
          const filtered = list.filter(
            (x: any) => x?.slug && x.slug !== currentSlug
          )
          setItems(filtered.slice(0, 12)) // візьмемо 10–12, щоб було що крутити
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
  }, [currentSlug])

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
        className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center rounded-full border bg-white shadow-sm hover:border-black transition cursor-pointer"
        aria-label="Prev"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => scrollByAmount('right')}
        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 items-center justify-center rounded-full border bg-white shadow-sm hover:border-black transition cursor-pointer"
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

            // намагаємось знайти картинку/ціну максимально гнучко
            const image =
              p?.image ||
              p?.mainImage ||
              p?.variants?.[0]?.image ||
              p?.variants?.[0]?.images?.[0]?.url ||
              '/img/placeholder.png'

            const price =
              p?.basePriceUAH ??
              p?.priceUAH ??
              p?.variants?.[0]?.priceUAH ??
              null

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
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-sm text-gray-900 truncate">
                      {p?.name}
                    </div>
                    {price !== null && (
                      <div className="text-sm text-gray-900 whitespace-nowrap">
                        {price} ₴
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
