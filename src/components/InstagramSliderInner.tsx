'use client'

import Image from 'next/image'
import { Swiper, SwiperSlide } from 'swiper/react'
import { A11y } from 'swiper/modules'
import { useRef, useState } from 'react'
import type { WheelEvent } from 'react'
import type { Swiper as SwiperType } from 'swiper'
import 'swiper/css'
import { useT } from '@/lib/i18n'
import type { InstagramPostDTO } from '@/lib/home-page-config'

export default function InstagramSliderInner({ posts }: { posts: InstagramPostDTO[] }) {
  const t = useT()
  const [swiper, setSwiper] = useState<SwiperType | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const lastWheelAtRef = useRef(0)

  if (posts.length === 0) return null

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!swiper || posts.length <= 1) return

    const deltaX = event.deltaX
    const deltaY = event.deltaY
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    // React only to horizontal touchpad/mouse wheel gestures.
    // Vertical page scroll must pass through untouched.
    if (absX < 16) return
    if (absX <= absY * 1.15) return

    const now = Date.now()
    if (now - lastWheelAtRef.current < 420) {
      event.preventDefault()
      return
    }

    lastWheelAtRef.current = now
    event.preventDefault()

    if (deltaX > 0) {
      swiper.slideNext()
      return
    }

    swiper.slidePrev()
  }

  return (
    <div className="mx-auto">
      <div className="relative pb-8">
        <div onWheel={handleWheel}>
        <Swiper
          modules={[A11y]}
          loop={posts.length > 1}
          grabCursor
          simulateTouch
          allowTouchMove={posts.length > 1}
          touchRatio={1}
          threshold={8}
          touchStartPreventDefault={false}
          speed={300}
          slidesPerView={1.2}
          slidesPerGroup={1}
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
          className="w-full [touch-action:pan-y]"
          onSwiper={(instance) => {
            setSwiper(instance)
            setActiveIndex(instance.realIndex)
          }}
          onSlideChange={(instance) => {
            setActiveIndex(instance.realIndex)
          }}
        >
          {posts.map((slide) => (
            <SwiperSlide key={slide.id}>
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
                        <span>{t('Перейти в Instagram', 'Open Instagram')}</span>
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

        {posts.length > 1 ? (
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
            {posts.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => {
                  if (!swiper) return
                  if (swiper.params.loop) {
                    swiper.slideToLoop(index)
                    return
                  }
                  swiper.slideTo(index)
                }}
                aria-label={`Перейти до слайду ${index + 1}`}
                className={`h-2.5 w-2.5 rounded-full transition ${
                  index === activeIndex
                    ? 'bg-[#FF3D8C]'
                    : 'bg-[#FF3D8C]/45 hover:bg-[#FF3D8C]/75'
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
