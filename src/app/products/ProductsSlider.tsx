'use client'

import { useEffect, useRef } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import {
  Navigation,
  Keyboard,
  A11y,
  FreeMode,
  Mousewheel,
} from 'swiper/modules'

import ProductCardLarge from './ProductCardLarge'
import { PRODUCTS } from '@/lib/products'

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
  // зовнішні стрілки
  const prevRef = useRef<HTMLButtonElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  // доступ до інстансу Swiper
  const swiperRef = useRef<any>(null)

  // після маунту прив’язуємо стрілки та ре-ініт навігації
  useEffect(() => {
    const s = swiperRef.current
    if (!s || !prevRef.current || !nextRef.current) return
    if (!s.params.navigation) s.params.navigation = {}
    s.params.navigation.prevEl = prevRef.current
    s.params.navigation.nextEl = nextRef.current
    s.navigation.destroy()
    s.navigation.init()
    s.navigation.update()
  }, [])

  return (
    <section className="relative">
      {/* Mobile: вертикальний список */}
      <div className="md:hidden max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        {PRODUCTS.map((p) => (
          <ProductCardLarge key={p.id} p={p} />
        ))}
      </div>

      {/* Tablet/Desktop: Swiper */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-[50px]">
          <div className="mx-auto relative w-full overflow-visible">
            {/* зовнішні стрілки: 12px від картки; 16x21 */}
            <button
              ref={prevRef}
              aria-label="Prev"
              className="absolute left-2 sm:left-3 lg:-left-[32px] top-1/2 -translate-y-1/2 z-10 h-[21px] w-[16px]
                         hidden md:flex items-center justify-center text-gray-400 hover:text-[#FF3D8C] transition cursor-pointer"
            >
              <Chevron dir="left" className="h-[21px] w-[16px]" />
            </button>
            <button
              ref={nextRef}
              aria-label="Next"
              className="absolute right-2 sm:right-3 lg:-right-[32px] top-1/2 -translate-y-1/2 z-10 h-[21px] w-[16px]
                         hidden md:flex items-center justify-center text-gray-400 hover:text-[#FF3D8C] transition cursor-pointer"
            >
              <Chevron dir="right" className="h-[21px] w-[16px]" />
            </button>

            <Swiper
              modules={[Navigation, Keyboard, A11y, FreeMode, Mousewheel]}
              onSwiper={(s) => (swiperRef.current = s)}
              // точні вимоги
              direction="horizontal"
              grabCursor={true}
              simulateTouch={true}
              touchRatio={1}
              mousewheel={{
                forceToAxis: true,
                sensitivity: 0.8,
              }}
              spaceBetween={22}
              loop={true}
              freeMode={true}
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
              {PRODUCTS.map((p) => (
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
