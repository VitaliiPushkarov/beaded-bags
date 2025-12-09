'use client'

import { useEffect, useRef, useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Keyboard, A11y, FreeMode, Mousewheel } from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper'
import ProductCardLarge, { type ProductWithVariants } from './ProductCardLarge'
import { Skeleton } from '@/components/ui/Skeleton'

function Chevron({
  dir = 'left',
  className = '',
}: {
  dir?: 'left' | 'right'
  className?: string
}) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden="true">
      {dir === 'left' ? (
        <path
          d="M15 19L8 12l7-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M9 5l7 7-7 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

export default function ProductsSlider() {
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [loading, setLoading] = useState(true)
  const swiperRef = useRef<SwiperType | null>(null)

  useEffect(() => {
    async function loadProducts() {
      setLoading(true)
      try {
        const res = await fetch('/api/products', { cache: 'no-store' })
        const data = (await res.json()) as ProductWithVariants[]
        setProducts(data)
      } catch (err) {
        console.error('❌ Failed to load products:', err)
      } finally {
        setLoading(false)
      }
    }
    loadProducts()
  }, [])

  return (
    <section className="relative mx-auto py-12">
      {/* Mobile: вертикальний список */}
      <div className="md:hidden max-w-full mx-auto px-6 space-y-5">
        <h2 className="text-2xl font-semibold mb-5">КАТАЛОГ</h2>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="w-full aspect-3/4" />
              <Skeleton className="w-2/3 h-4" />
              <Skeleton className="w-1/3 h-4" />
            </div>
          ))
        ) : (
          <>
            {/* Показуємо лише перші 6 товарів */}
            {products.slice(0, 6).map((p) => (
              <ProductCardLarge key={p.id} p={p} />
            ))}

            {/* Show catalog link */}
            <a
              href="/shop"
              className="block w-full text-center py-3 mt-4 bg-black text-white rounded-md text-sm font-medium hover:bg-[#FF3D8C] transition"
            >
              Показати всі товари
            </a>
          </>
        )}
      </div>

      {/* Tablet/Desktop: Swiper */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-[1440px] 2xl:max-w-full px-[38px]">
          <h2 className="text-2xl font-semibold mb-5">КАТАЛОГ</h2>
          <div className="mx-auto relative w-full overflow-visible">
            <button
              onClick={() => swiperRef.current?.slideNext()}
              aria-label="Next"
              className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 h-7 w-[21px] hidden md:flex items-center justify-center text-[#FF3D8C] hover:opacity-80 transition cursor-pointer"
            >
              <Chevron dir="right" className="h-7 w-[21px]" />
            </button>

            <Swiper
              modules={[Keyboard, A11y, FreeMode, Mousewheel]}
              onSwiper={(s) => (swiperRef.current = s)}
              direction="horizontal"
              grabCursor
              simulateTouch
              touchRatio={1}
              mousewheel={{ forceToAxis: true, sensitivity: 0.8 }}
              spaceBetween={22}
              freeMode
              loop
              speed={450}
              keyboard={{ enabled: true }}
              breakpoints={{
                0: { slidesPerView: 1, spaceBetween: 16 }, // mobile
                768: { slidesPerView: 2, spaceBetween: 18 }, // tablet
                1024: { slidesPerView: 3, spaceBetween: 20 }, // laptop/desktop
              }}
              navigation={false}
              className="pr-20"
            >
              {products.map((p) => (
                <SwiperSlide key={p.id}>
                  <div>
                    <ProductCardLarge p={p} />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
      </div>
    </section>
  )
}
