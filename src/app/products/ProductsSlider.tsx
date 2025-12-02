'use client'

import { useEffect, useRef, useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import {
  Navigation,
  Keyboard,
  A11y,
  FreeMode,
  Mousewheel,
} from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper'
import type { NavigationOptions } from 'swiper/types'
import type { Product, ProductVariant } from '@prisma/client'

import ProductCardLarge from './ProductCardLarge'

type ProductsWithVariants = Product & {
  variants: ProductVariant[]
}

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
  const [products, setProducts] = useState<ProductsWithVariants[]>([])

  const prevRef = useRef<HTMLButtonElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const swiperRef = useRef<SwiperType | null>(null)

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch('/api/products', { cache: 'no-store' })
        const data = (await res.json()) as ProductsWithVariants[]
        setProducts(data)
      } catch (err) {
        console.error('❌ Failed to load products:', err)
      }
    }
    loadProducts()
  }, [])

  // ініціалізація зовнішніх стрілок після монту та оновлення даних
  useEffect(() => {
    const s = swiperRef.current
    if (!s || !prevRef.current || !nextRef.current) return

    const nav = (s.params.navigation || {}) as NavigationOptions
    nav.prevEl = prevRef.current
    nav.nextEl = nextRef.current
    nav.enabled = true
    s.params.navigation = nav

    // перевстановлюємо навігацію після зміни посилань
    s.navigation.destroy()
    s.navigation.init()
    s.navigation.update()
  }, [products])

  return (
    <section className="relative mx-auto py-12">
      {/* Mobile: вертикальний список */}
      <div className="md:hidden max-w-full mx-auto px-6 space-y-5">
        <h2 className="text-2xl font-semibold mb-5">КАТАЛОГ</h2>
        {products.map((p) => (
          <ProductCardLarge key={p.id} p={p} />
        ))}
      </div>

      {/* Tablet/Desktop: Swiper */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-full px-6">
          <h2 className="text-2xl font-semibold mb-5">КАТАЛОГ</h2>
          <div className="mx-auto relative w-full overflow-visible">
            {/* зовнішні стрілки: 12px від картки; 16x21 */}
            <button
              ref={prevRef}
              aria-label="Prev"
              className="absolute left-2 sm:left-3 lg:-left-5 top-1/2 -translate-y-1/2 z-10 h-[21px] w-4
                         hidden md:flex items-center justify-center text-gray-400 hover:text-[#FF3D8C] transition cursor-pointer"
            >
              <Chevron dir="left" className="h-[21px] w-4" />
            </button>
            <button
              ref={nextRef}
              aria-label="Next"
              className="absolute right-2 sm:right-3 lg:-right-5 top-1/2 -translate-y-1/2 z-10 h-[21px] w-4
                         hidden md:flex items-center justify-center text-gray-400 hover:text-[#FF3D8C] transition cursor-pointer"
            >
              <Chevron dir="right" className="h-[21px] w-4" />
            </button>

            <Swiper
              modules={[Navigation, Keyboard, A11y, FreeMode, Mousewheel]}
              onSwiper={(s) => (swiperRef.current = s)}
              direction="horizontal"
              grabCursor
              simulateTouch
              touchRatio={1}
              mousewheel={{ forceToAxis: true, sensitivity: 0.8 }}
              spaceBetween={22}
              freeMode
              speed={450}
              keyboard={{ enabled: true }}
              breakpoints={{
                0: { slidesPerView: 1, spaceBetween: 16 }, // mobile
                768: { slidesPerView: 2, spaceBetween: 18 }, // tablet
                1024: { slidesPerView: 3, spaceBetween: 20 }, // laptop
                1280: { slidesPerView: 4, spaceBetween: 22 }, // desktop
              }}
              navigation={false} // зовнішні стрілки підключаємо вручну через useEffect
              className=""
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
