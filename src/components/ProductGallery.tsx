'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Gallery, Item } from 'react-photoswipe-gallery'

import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation } from 'swiper/modules'

import 'swiper/css'
import 'swiper/css/navigation'

type PhotoGalleryProps = {
  images: string[]
}

export default function PhotoGallery({ images }: PhotoGalleryProps) {
  const placeholder = '/img/placeholder.png'
  const list = images.length ? images : [placeholder]
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([])

  useEffect(() => {
    Promise.all(
      list.map(
        (src) =>
          new Promise<{ w: number; h: number }>((resolve) => {
            const img = new window.Image()
            img.src = src
            img.onload = () => resolve({ w: img.width, h: img.height })
            img.onerror = () => resolve({ w: 1600, h: 1600 }) // fallback
          })
      )
    ).then(setSizes)
  }, [list])

  if (!sizes.length) return null
  return (
    <div className="relative w-full md:w-[66%]">
      <Gallery>
        <Swiper
          modules={[Navigation]}
          navigation={{
            nextEl: '.photo-gallery-next',
            prevEl: '.photo-gallery-prev',
          }}
          slidesPerView={1}
          breakpoints={{
            1024: {
              slidesPerView: 2,
              spaceBetween: 30,
            },
          }}
          spaceBetween={16}
          centeredSlides={false}
          loop={true}
          className="w-full overflow-visible relative"
        >
          {list.map((src, i) => (
            <SwiperSlide key={i}>
              <Item
                original={src}
                thumbnail={src}
                width={sizes[i]?.w}
                height={sizes[i]?.h}
              >
                {({ ref, open }) => (
                  <div
                    ref={ref as (node: HTMLDivElement | null) => void}
                    onClick={open}
                    className="relative h-[580px] w-full cursor-pointer overflow-hidden rounded bg-gray-100"
                  >
                    <Image
                      src={src || placeholder}
                      alt="Фото товару"
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
              </Item>
            </SwiperSlide>
          ))}
          {/* Chevrons */}
          <button
            className="photo-gallery-prev absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10
                   hidden md:flex items-center justify-center text-gray-400 hover:text-black transition cursor-pointer"
            aria-label="Попереднє фото"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                d="M15 6l-6 6 6 6"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            className="photo-gallery-next absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10
                   hidden md:flex items-center justify-center text-gray-400 hover:text-black transition cursor-pointer"
            aria-label="Наступне фото"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </Swiper>
      </Gallery>
    </div>
  )
}
