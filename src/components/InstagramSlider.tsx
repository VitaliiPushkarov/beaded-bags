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
  },
  {
    id: 2,
    src: '/img/instagram/inst2.jpg',
    href: 'https://www.instagram.com/p/DRkWfJ1DIZo/',
    alt: 'Instagram Image 2',
  },
  {
    id: 3,
    src: '/img/instagram/inst3.jpg',
    href: 'https://www.instagram.com/p/DRmxdVJDJ3L/?img_index=1',
    alt: 'Instagram Image 3',
  },
  {
    id: 4,
    src: '/img/instagram/inst4.jpg',
    href: 'https://www.instagram.com/p/DRzpakajLzB/?img_index=1',
    alt: 'Instagram Image 4',
  },
  {
    id: 5,
    src: '/img/instagram/inst5.jpg',
    href: 'https://www.instagram.com/p/DRuvg6_DOzc/?img_index=1',
    alt: 'Instagram Image 5',
  },
  {
    id: 6,
    src: '/img/instagram/inst6.jpg',
    href: 'https://www.instagram.com/p/DRhyOB_jNAG/?img_index=1',
    alt: 'Instagram Image 6',
  },
]

type LoadedState = {
  [id: number]: boolean
}

export default function InstagramSlider() {
  const swiperRef = useRef<SwiperType | null>(null)

  const [loadedSlides, setLoadedSlides] = useState<LoadedState>({})

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

  const handleImageLoad = (id: number) => {
    setLoadedSlides((prev) => ({
      ...prev,
      [id]: true,
    }))
  }

  return (
    <section className="w-full py-8">
      <div className="mx-auto">
        <div
          className="relative"
          onMouseEnter={() => swiperRef.current?.autoplay.stop()}
          onMouseLeave={() => swiperRef.current?.autoplay.start()}
        >
          <Swiper
            modules={[A11y, FreeMode, Autoplay]}
            loop={isDesktop}
            freeMode={isDesktop}
            grabCursor
            speed={10000}
            autoplay={
              isDesktop
                ? {
                    delay: 0,
                    disableOnInteraction: false,
                  }
                : false
            }
            slidesPerView={1}
            spaceBetween={8}
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
            className="w-full"
            simulateTouch={true}
            followFinger={true}
            onSwiper={(swiper) => {
              swiperRef.current = swiper
            }}
          >
            {instSliderImages.map((slide) => (
              <SwiperSlide key={slide.src}>
                <a
                  href={slide.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full h-full"
                >
                  <div className="relative w-full h-[460px] md:h-[540px] 2xl:h-[680px] overflow-hidden">
                    <div
                      className={`absolute inset-0 animate-pulse bg-linear-to-r from-neutral-200 via-neutral-100 to-neutral-300 transition-opacity duration-300 ${
                        loadedSlides[slide.id] ? 'opacity-0' : 'opacity-100'
                      }`}
                    />
                    <Image
                      src={slide.src}
                      alt={slide.alt}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 20vw"
                      className={`object-cover transition-opacity duration-300 ${
                        loadedSlides[slide.id] ? 'opacity-100' : 'opacity-0'
                      }`}
                      onLoadingComplete={() => handleImageLoad(slide.id)}
                    />
                  </div>
                </a>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </section>
  )
}
