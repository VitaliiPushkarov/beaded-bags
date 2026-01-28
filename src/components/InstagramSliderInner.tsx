'use client'

import Image from 'next/image'
import { Swiper, SwiperSlide } from 'swiper/react'
import { A11y, FreeMode, Autoplay } from 'swiper/modules'
import { useEffect, useRef, useState } from 'react'
import type { Swiper as SwiperType } from 'swiper'

const instSliderImages = [
  {
    id: 1,
    src: '/img/instagram/inst1.jpg',
    href: 'https://www.instagram.com/p/DRsKzcsjNSG/',
    alt: 'Instagram Image 1',
    caption: 'Сумка Truffle Tote - мінімалізм, що витримує твій ритм дня.',
  },
  {
    id: 2,
    src: '/img/instagram/inst2.jpg',
    href: 'https://www.instagram.com/p/DRkWfJ1DIZo/',
    alt: 'Instagram Image 2',
    caption:
      'Cozy Bag — в’язана бананка-мішечок, що створена для твоїх шалених буднів.',
  },
  {
    id: 3,
    src: '/img/instagram/inst3.jpg',
    href: 'https://www.instagram.com/p/DRmxdVJDJ3L/?img_index=1',
    alt: 'Instagram Image 3',
    caption:
      'Металевий чохол з бісеру повторює її характер: стриманий, сталевий та витончений. ',
  },
  {
    id: 4,
    src: '/img/instagram/inst4.jpg',
    href: 'https://www.instagram.com/p/DRzpakajLzB/?img_index=1',
    alt: 'Instagram Image 4',
    caption:
      'Gerdan Electric: лаймовий неон, лаконічна форма та знайомий усім класичний принт.',
  },
  {
    id: 5,
    src: '/img/instagram/inst5.jpg',
    href: 'https://www.instagram.com/p/DRuvg6_DOzc/?img_index=1',
    alt: 'Instagram Image 5',
    caption:
      'Рожева Cozy Bag виглядає, як базовий аксесуар, але чомусь усі обертаються.',
  },
  {
    id: 6,
    src: '/img/instagram/inst6.jpg',
    href: 'https://www.instagram.com/p/DRhyOB_jNAG/?img_index=1',
    alt: 'Instagram Image 6',
    caption: 'Gerdan Glassy — сумка, яка ніби створена зі скла.',
  },
]

export default function InstagramSliderInner() {
  const swiperRef = useRef<SwiperType | null>(null)

  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const update = () => {
      if (typeof window !== 'undefined') {
        setIsDesktop(window.innerWidth >= 768)
      }
    }

    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <div className="mx-auto">
      <div
        className="relative"
        onMouseEnter={() => {
          if (isDesktop) swiperRef.current?.autoplay.stop()
        }}
        onMouseLeave={() => {
          if (isDesktop) swiperRef.current?.autoplay.start()
        }}
      >
        <Swiper
          modules={[A11y, FreeMode, Autoplay]}
          loop={isDesktop}
          freeMode={isDesktop}
          grabCursor
          speed={isDesktop ? 10000 : 300}
          autoplay={
            isDesktop
              ? {
                  delay: 0,
                  disableOnInteraction: false,
                }
              : undefined
          }
          slidesPerView={1.2}
          spaceBetween={12}
          breakpoints={{
            768: {
              slidesPerView: 2,
              spaceBetween: 12,
            },
            1024: {
              slidesPerView: 4,
              spaceBetween: 8,
            },
          }}
          resistanceRatio={0}
          className="w-full"
          simulateTouch={true}
          followFinger={true}
          onSwiper={(swiper) => {
            swiperRef.current = swiper
            if (!isDesktop) {
              // hard-disable autoplay on mobile
              // (prevents any resume after interactions)
              swiper.params.autoplay = false
              swiper.autoplay?.stop()
            }
          }}
        >
          {instSliderImages.map((slide) => (
            <SwiperSlide key={slide.src}>
              <a
                href={slide.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group block w-full h-full"
              >
                <div className="relative w-full h-[460px] md:h-[540px] 2xl:h-[680px] overflow-hidden backface-visibility:hidden transform:translateZ(0)">
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/40">
                    <div className="max-w-[90%] text-center opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/80 px-4 py-2 text-white text-sm tracking-wide">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5ZM12 7a5 5 0 1 1 0 10a5 5 0 0 1 0-10Zm0 1.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7Zm5.25-.75a.75.75 0 1 1 0 1.5a.75.75 0 0 1 0-1.5Z" />
                        </svg>
                        <span>Перейти в Instagram</span>
                      </span>

                      {slide.caption && (
                        <div className="mt-3 text-white/95 text-sm md:text-base leading-snug">
                          {slide.caption}
                        </div>
                      )}
                    </div>
                  </div>
                  <Image
                    src={slide.src}
                    alt={slide.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 20vw"
                    className="object-cover backface-visibility:hidden transform:translateZ(0)"
                  />
                </div>
              </a>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  )
}
