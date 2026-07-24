'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Gallery, Item } from 'react-photoswipe-gallery'

import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation } from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper'

import 'swiper/css'
import 'swiper/css/navigation'
import 'photoswipe/dist/photoswipe.css'
import { useT } from '@/lib/i18n'

type PhotoGalleryProps = {
  images: string[]
  onReady?: () => void
}

// Nominal large edge (px) used for the dimensions we hand to PhotoSwipe. Only
// the aspect ratio matters for avoiding distortion; this sets a sensible zoom
// ceiling.
const PHOTOSWIPE_MAX_EDGE = 2000

// For dimension probing we only need the aspect ratio, so for Cloudinary
// sources we fetch a tiny resized variant instead of the full-resolution
// original. Non-Cloudinary URLs are probed as-is.
function toProbeUrl(src: string): string {
  const marker = '/image/upload/'
  const uploadIdx = src.indexOf(marker)
  if (!src.includes('res.cloudinary.com') || uploadIdx === -1) return src
  const insertAt = uploadIdx + marker.length
  return `${src.slice(0, insertAt)}w_120,c_limit,q_auto,f_auto/${src.slice(insertAt)}`
}

// Scale probed dimensions to a large nominal size while preserving aspect, so
// PhotoSwipe renders the image at its real proportions (no stretching).
function scaleToLargeAspect(width: number, height: number): { w: number; h: number } {
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height)) {
    return { w: PHOTOSWIPE_MAX_EDGE, h: PHOTOSWIPE_MAX_EDGE }
  }
  if (width >= height) {
    return { w: PHOTOSWIPE_MAX_EDGE, h: Math.round((height / width) * PHOTOSWIPE_MAX_EDGE) }
  }
  return { w: Math.round((width / height) * PHOTOSWIPE_MAX_EDGE), h: PHOTOSWIPE_MAX_EDGE }
}

export default function PhotoGallery({ images, onReady }: PhotoGalleryProps) {
  const t = useT()
  const placeholder = '/img/placeholder.png'
  const list = useMemo(() => (images.length ? images : [placeholder]), [images])
  const hasMultipleImages = list.length > 1
  const [activeIndex, setActiveIndex] = useState(0)
  const [sizesByUrl, setSizesByUrl] = useState<
    Partial<Record<string, { w: number; h: number }>>
  >({})
  const sizesByUrlRef = useRef<
    Partial<Record<string, { w: number; h: number }>>
  >({})
  const inflightByUrlRef = useRef<Partial<Record<string, Promise<void>>>>({})

  const listKey = useMemo(() => list.join('|'), [list])

  const scheduleIdle = useCallback((task: () => void) => {
    if (typeof window === 'undefined') return
    if ('requestIdleCallback' in window) {
      ;(
        window as Window & {
          requestIdleCallback: (
            callback: () => void,
            opts?: { timeout: number },
          ) => number
        }
      ).requestIdleCallback(task, { timeout: 800 })
      return
    }
    setTimeout(task, 120)
  }, [])

  const ensureImageSize = useCallback(
    (src: string, priority: 'now' | 'idle') => {
      if (!src || sizesByUrlRef.current[src] || inflightByUrlRef.current[src])
        return

      const startLoad = () => {
        if (sizesByUrlRef.current[src] || inflightByUrlRef.current[src]) return

        inflightByUrlRef.current[src] = new Promise<void>((resolve) => {
          const img = new window.Image()
          img.decoding = 'async'
          img.src = toProbeUrl(src)
          img.onload = () => {
            const next = scaleToLargeAspect(img.naturalWidth, img.naturalHeight)
            sizesByUrlRef.current[src] = next
            setSizesByUrl((prev) =>
              prev[src] ? prev : { ...prev, [src]: next },
            )
            resolve()
          }
          img.onerror = () => {
            const fallback = { w: PHOTOSWIPE_MAX_EDGE, h: PHOTOSWIPE_MAX_EDGE }
            sizesByUrlRef.current[src] = fallback
            setSizesByUrl((prev) =>
              prev[src] ? prev : { ...prev, [src]: fallback },
            )
            resolve()
          }
        }).finally(() => {
          delete inflightByUrlRef.current[src]
        })
      }

      if (priority === 'now') {
        startLoad()
        return
      }

      // Move non-critical image-size probing off the main interaction path.
      scheduleIdle(startLoad)
    },
    [scheduleIdle],
  )

  const preloadAround = useCallback(
    (centerIndex: number) => {
      const windowIndexes = [
        centerIndex,
        centerIndex + 1,
        centerIndex - 1,
      ].filter((idx) => idx >= 0 && idx < list.length)
      windowIndexes.forEach((idx, i) => {
        const src = list[idx]
        if (!src) return
        ensureImageSize(src, i === 0 ? 'now' : 'idle')
      })
    },
    [ensureImageSize, list],
  )

  useEffect(() => {
    setActiveIndex(0)
  }, [listKey])

  useEffect(() => {
    preloadAround(activeIndex)
  }, [activeIndex, preloadAround])

  useEffect(() => {
    // Probe the real aspect ratio of every image up front (lightweight thanks
    // to toProbeUrl). The PhotoSwipe lightbox lets you swipe through the whole
    // set, so any image left at the square fallback would appear stretched.
    list.forEach((src, idx) => ensureImageSize(src, idx === 0 ? 'now' : 'idle'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey, ensureImageSize])

  useEffect(() => {
    onReady?.()
  }, [onReady])

  const mobileBullets = useMemo(() => {
    if (!hasMultipleImages) return []

    if (list.length <= 3) {
      return Array.from({ length: list.length }, (_, i) => i === activeIndex)
    }

    if (activeIndex <= 0) return [true, false, false]
    if (activeIndex >= list.length - 1) return [false, false, true]
    return [false, true, false]
  }, [activeIndex, hasMultipleImages, list.length])

  return (
    <div className="relative w-full">
      <Gallery>
        <div className="relative w-full">
          <div className="w-full overflow-hidden">
            <Swiper
              key={listKey}
              modules={[Navigation]}
              onSlideChange={(swiper: SwiperType) => {
                setActiveIndex(swiper.realIndex ?? swiper.activeIndex ?? 0)
              }}
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
              loop={false}
              className="w-full relative transform-gpu backface-visibility:hidden"
            >
              {list.map((src, i) => (
                <SwiperSlide
                  key={i}
                  className="transform-gpu backface-visibility:hidden"
                >
                  <Item
                    original={src}
                    thumbnail={src}
                    width={sizesByUrl[src]?.w ?? 1600}
                    height={sizesByUrl[src]?.h ?? 1600}
                  >
                    {({ ref, open }) => (
                      <div
                        ref={ref as (node: HTMLDivElement | null) => void}
                        onClick={open}
                        className="relative h-[420px] md:h-[580px] w-full cursor-pointer overflow-hidden rounded bg-white will-change-transform transform-gpu backface-visibility:hidden"
                      >
                        <Image
                          src={src || placeholder}
                          alt={t('Фото товару', 'Product image')}
                          fill
                          className="object-cover"
                          priority={i === 0}
                          loading={i === 0 ? 'eager' : 'lazy'}
                          sizes="(min-width: 1024px) 66vw, 100vw"
                          quality={80}
                          fetchPriority={i === 0 ? 'high' : 'auto'}
                        />
                      </div>
                    )}
                  </Item>
                </SwiperSlide>
              ))}
            </Swiper>

            {hasMultipleImages && (
              <div className="mt-2 mb-2 md:hidden relative z-[2]">
                <div className="flex items-center justify-end text-[11px] text-gray-500 mb-2 pr-0.5">
                  <span>
                    {activeIndex + 1} / {list.length}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  {mobileBullets.map((isActive, index) => (
                    <span
                      key={`mobile-bullet-${index}`}
                      className={`h-2.5 w-2.5 rounded-full transition ${
                        isActive ? 'bg-pink-300' : 'bg-gray-300'
                      }`}
                      aria-hidden
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chevrons */}
          <button
            className="photo-gallery-prev absolute -left-3 top-1/2 -translate-y-1/2 z-10 bg-white shadow-sm rounded-full border h-10 w-10
                   hidden md:flex items-center justify-center hover:border-white hover:bg-[#FF3D8C] hover:text-white transition cursor-pointer"
            aria-label={t('Попереднє фото', 'Previous image')}
            type="button"
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
            className="photo-gallery-next absolute -right-3 top-1/2 -translate-y-1/2 z-10 bg-white shadow-sm rounded-full border h-10 w-10
                   hidden md:flex items-center justify-center hover:border-white hover:bg-[#FF3D8C] hover:text-white transition cursor-pointer"
            aria-label={t('Наступне фото', 'Next image')}
            type="button"
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
        </div>
      </Gallery>
    </div>
  )
}
