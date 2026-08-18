'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Gallery, Item } from 'react-photoswipe-gallery'

import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Thumbs } from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper'

import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/thumbs'
import 'photoswipe/dist/photoswipe.css'
import { useT } from '@/lib/i18n'

type PhotoGalleryProps = {
  images: string[]
  onReady?: () => void
  // 'thumbnails' shows one large image with a strip of thumbs beneath, used by
  // customisable variants where the lead image changes as options are picked.
  // Everything else keeps the carousel it has always had.
  layout?: 'carousel' | 'thumbnails'
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
function scaleToLargeAspect(
  width: number,
  height: number,
): { w: number; h: number } {
  if (
    !width ||
    !height ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return { w: PHOTOSWIPE_MAX_EDGE, h: PHOTOSWIPE_MAX_EDGE }
  }
  if (width >= height) {
    return {
      w: PHOTOSWIPE_MAX_EDGE,
      h: Math.round((height / width) * PHOTOSWIPE_MAX_EDGE),
    }
  }
  return {
    w: Math.round((width / height) * PHOTOSWIPE_MAX_EDGE),
    h: PHOTOSWIPE_MAX_EDGE,
  }
}

export default function PhotoGallery({
  images,
  onReady,
  layout = 'carousel',
}: PhotoGalleryProps) {
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

  if (layout === 'thumbnails') {
    // Keyed on the image list: selecting an option rebuilds it, and the two
    // Swipers must be torn down together. Without the remount the main Swiper
    // keeps pointing at a destroyed thumbs instance and throws on the next
    // render, so the swiper handles live in a child whose state resets with it.
    return (
      <ThumbnailGallery
        key={listKey}
        mobileBullets={mobileBullets}
        list={list}
        sizesByUrl={sizesByUrl}
        placeholder={placeholder}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        hasMultipleImages={hasMultipleImages}
      />
    )
  }

  return (
    <div className="relative w-full">
      <Gallery>
        <div className="relative w-full">
          <div className="relative w-full overflow-hidden">
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
                        className="relative aspect-3/4 w-full cursor-pointer overflow-hidden rounded bg-white will-change-transform transform-gpu backface-visibility:hidden"
                      >
                        <Image
                          src={src || placeholder}
                          alt={t('Фото товару', 'Product image')}
                          fill
                          className="object-contain"
                          priority={i === 0}
                          loading={i === 0 ? 'eager' : 'lazy'}
                          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 66vw, 100vw"
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
              // Sits over the bottom of the photo instead of taking a row
              // below it: dots centred, counter in the bottom-right corner.
              // pointer-events-none keeps the swipe and the tap-to-zoom
              // underneath working. Swiper's own root is z-index 1, so the
              // overlay needs at least 2 to paint above the slide.
              <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[2] flex items-center justify-center px-3 pb-3 md:hidden">
                <div className="flex items-center gap-2">
                  {mobileBullets.map((isActive, index) => (
                    <span
                      key={`mobile-bullet-${index}`}
                      className={`h-2.5 w-2.5 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition ${
                        isActive ? 'bg-pink-300' : 'bg-gray-300'
                      }`}
                      aria-hidden
                    />
                  ))}
                </div>
                <span className="absolute right-3  px-2 py-0.5 text-[11px] leading-none text-gray-600 ">
                  {activeIndex + 1} / {list.length}
                </span>
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

function ThumbnailGallery({
  list,
  sizesByUrl,
  placeholder,
  activeIndex,
  onActiveIndexChange,
  hasMultipleImages,
  mobileBullets,
}: {
  mobileBullets: boolean[]
  list: string[]
  sizesByUrl: Partial<Record<string, { w: number; h: number }>>
  placeholder: string
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  hasMultipleImages: boolean
}) {
  const t = useT()
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null)
  const [mainSwiper, setMainSwiper] = useState<SwiperType | null>(null)

  return (
    <div className="relative w-full">
      <Gallery>
        <Swiper
          modules={[Navigation, Thumbs]}
          onSwiper={setMainSwiper}
          onSlideChange={(swiper: SwiperType) => {
            onActiveIndexChange(swiper.realIndex ?? swiper.activeIndex ?? 0)
          }}
          thumbs={{
            swiper:
              thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null,
          }}
          slidesPerView={1}
          // Mobile is a copy of the carousel layout, down to the gap that shows
          // between slides mid-swipe. Desktop keeps its flush single slide.
          spaceBetween={16}
          breakpoints={{ 768: { spaceBetween: 0 } }}
          className="w-full rounded overflow-hidden"
        >
          {list.map((src, i) => (
            <SwiperSlide key={`main-slide-${i}`}>
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
                    className="relative aspect-3/4 w-full cursor-zoom-in overflow-hidden rounded bg-white md:mx-auto md:max-w-[435px]"
                  >
                    <Image
                      src={src || placeholder}
                      alt={t('Фото товару', 'Product image')}
                      fill
                      className="object-contain"
                      priority={i === 0}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      sizes="(min-width: 768px) 435px, 100vw"
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
          // Wrapper, not the Swiper itself: Tailwind's `hidden` and Swiper's own
          // `.swiper { display: block }` have equal specificity and Swiper wins.
          <div className="hidden md:block">
            <Swiper
              modules={[Thumbs]}
              onSwiper={setThumbsSwiper}
              watchSlidesProgress
              slidesPerView={4}
              spaceBetween={8}
              breakpoints={{ 640: { slidesPerView: 6, spaceBetween: 10 } }}
              className="mt-3 w-full"
            >
              {list.map((src, i) => (
                <SwiperSlide key={`thumb-${i}`}>
                  <button
                    type="button"
                    onClick={() => mainSwiper?.slideTo(i)}
                    aria-label={`${t('Фото', 'Photo')} ${i + 1}`}
                    className={`relative block h-16 w-full overflow-hidden rounded border transition md:h-20 ${
                      i === activeIndex
                        ? 'border-[#FF3D8C]'
                        : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <Image
                      src={src || placeholder}
                      alt=""
                      fill
                      className="object-contain"
                      sizes="120px"
                      quality={60}
                    />
                  </button>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        )}

        {hasMultipleImages && (
          // Mobile gets the swipe-plus-dots affordance the rest of the
          // catalogue has rather than a thumbnail strip, and spans the full
          // width exactly like the carousel's — the slide underneath is now the
          // same size, so there is nothing narrower to align to.
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[2] flex items-center justify-center px-3 pb-3 md:hidden">
            <div className="flex items-center gap-2">
              {mobileBullets.map((isActive, index) => (
                <span
                  key={`thumb-mobile-bullet-${index}`}
                  className={`h-2.5 w-2.5 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition ${
                    isActive ? 'bg-pink-300' : 'bg-gray-300'
                  }`}
                  aria-hidden
                />
              ))}
            </div>
            <span className="absolute right-3 rounded-full bg-white/75 px-2 py-0.5 text-[11px] leading-none text-gray-600 backdrop-blur-sm">
              {activeIndex + 1} / {list.length}
            </span>
          </div>
        )}
      </Gallery>
    </div>
  )
}
