'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { HomeHeroSlideDTO } from '@/lib/home-hero-banner'

type Props = {
  slides: HomeHeroSlideDTO[]
  autoPlayMs?: number
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

export default function HeroBlockSlider({ slides, autoPlayMs = 9000 }: Props) {
  const ordered = useMemo(() => {
    const sorted = [...slides].sort(
      (a, b) => a.sort - b.sort || a.id.localeCompare(b.id),
    )
    const active = sorted.filter((slide) => slide.isActive)
    return active.length > 0 ? active : sorted
  }, [slides])

  const hasLoop = ordered.length > 1
  const loopSlides = useMemo(() => {
    if (!hasLoop) return ordered
    return [ordered[ordered.length - 1], ...ordered, ordered[0]]
  }, [hasLoop, ordered])

  const [activeIndex, setActiveIndex] = useState(0)
  const [isTransitionEnabled, setIsTransitionEnabled] = useState(true)
  const touchStartXRef = useRef<number | null>(null)
  const touchEndXRef = useRef<number | null>(null)

  useEffect(() => {
    setActiveIndex(0)
    setIsTransitionEnabled(true)
  }, [ordered.length])

  useEffect(() => {
    if (!hasLoop) return

    const timer = window.setInterval(() => {
      goNext()
    }, autoPlayMs)

    return () => window.clearInterval(timer)
  }, [hasLoop, autoPlayMs])

  useEffect(() => {
    if (isTransitionEnabled) return

    const id = window.requestAnimationFrame(() => {
      setIsTransitionEnabled(true)
    })

    return () => window.cancelAnimationFrame(id)
  }, [isTransitionEnabled])

  if (ordered.length === 0) return null

  const SWIPE_THRESHOLD = 40

  const goPrev = () => {
    if (!hasLoop) {
      setActiveIndex(0)
      return
    }

    setIsTransitionEnabled(true)
    setActiveIndex((prev) => prev - 1)
  }

  const goNext = () => {
    if (!hasLoop) {
      setActiveIndex(0)
      return
    }

    setIsTransitionEnabled(true)
    setActiveIndex((prev) => prev + 1)
  }

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const x = event.touches[0]?.clientX
    if (typeof x !== 'number') return
    touchStartXRef.current = x
    touchEndXRef.current = x
  }

  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const x = event.touches[0]?.clientX
    if (typeof x !== 'number') return
    touchEndXRef.current = x
  }

  const onTouchEnd = () => {
    const startX = touchStartXRef.current
    const endX = touchEndXRef.current
    if (startX == null || endX == null) return

    const delta = startX - endX
    if (Math.abs(delta) >= SWIPE_THRESHOLD) {
      if (delta > 0) goNext()
      else goPrev()
    }

    touchStartXRef.current = null
    touchEndXRef.current = null
  }

  const currentDotIndex =
    ((activeIndex % ordered.length) + ordered.length) % ordered.length

  const translateIndex = hasLoop ? activeIndex + 1 : activeIndex

  // Only the first *visible* slide is the LCP candidate. Previously
  // `priority={index <= 1}` eagerly preloaded the off-screen clone and the
  // second slide too, so up to 4 hero images (mobile + desktop) competed for
  // bandwidth with the actual LCP image. Preload just the first real slide.
  const priorityIndex = hasLoop ? 1 : 0

  const onTrackTransitionEnd = () => {
    if (!hasLoop) return

    if (activeIndex >= ordered.length) {
      setIsTransitionEnabled(false)
      setActiveIndex(0)
      return
    }

    if (activeIndex < 0) {
      setIsTransitionEnabled(false)
      setActiveIndex(ordered.length - 1)
    }
  }

  return (
    <section className="relative w-full">
      <div className="relative px-0 md:px-6">
        <div
          className="relative"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="md:hidden overflow-hidden aspect-[2/3]">
            <div
              className={`flex ease-in-out ${
                isTransitionEnabled ? 'transition-transform duration-700' : ''
              }`}
              style={{ transform: `translateX(-${translateIndex * 100}%)` }}
              onTransitionEnd={onTrackTransitionEnd}
            >
              {loopSlides.map((slide, index) => (
                <Link
                  key={`${slide.id}-mobile-${index}`}
                  href={slide.linkHref}
                  className="block w-full shrink-0"
                >
                  <Image
                    src={slide.mobileImage}
                    alt={slide.mobileAlt}
                    width={1200}
                    height={1800}
                    priority={index === priorityIndex}
                    loading={index === priorityIndex ? undefined : 'lazy'}
                    className="h-full w-full object-contain"
                    sizes="100vw"
                    quality={60}
                  />
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden md:block overflow-hidden aspect-[2/1]">
            <div
              className={`flex ease-in-out ${
                isTransitionEnabled ? 'transition-transform duration-700' : ''
              }`}
              style={{ transform: `translateX(-${translateIndex * 100}%)` }}
              onTransitionEnd={onTrackTransitionEnd}
            >
              {loopSlides.map((slide, index) => (
                <Link
                  key={`${slide.id}-desktop-${index}`}
                  href={slide.linkHref}
                  className="block w-full shrink-0"
                >
                  <Image
                    src={slide.desktopImage}
                    alt={slide.desktopAlt}
                    width={2880}
                    height={1440}
                    priority={index === priorityIndex}
                    loading={index === priorityIndex ? undefined : 'lazy'}
                    className="h-full w-full object-contain"
                    sizes="(min-width: 768px) calc(100vw - 48px), 100vw"
                    quality={80}
                  />
                </Link>
              ))}
            </div>
          </div>

          {ordered.length > 1 ? (
            <>
                <button
                  type="button"
                  onClick={() => {
                    goPrev()
                  }}
                aria-label="Previous"
                className="absolute left-2 top-1/2 z-20 hidden h-7 w-[21px] -translate-y-1/2 cursor-pointer items-center justify-center text-[#FF3D8C] transition hover:opacity-80 md:-left-4 md:flex"
              ></button>
                <button
                  type="button"
                  onClick={() => {
                    goNext()
                  }}
                aria-label="Next"
                className="absolute right-2 top-1/2 z-20 hidden h-7 w-[21px] -translate-y-1/2 cursor-pointer items-center justify-center text-[#FF3D8C] transition hover:opacity-80 md:-right-4 md:flex"
              >
                <Chevron dir="right" className="h-7 w-[21px]" />
              </button>

              <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2">
                {ordered.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => {
                      setIsTransitionEnabled(true)
                      setActiveIndex(index)
                    }}
                    aria-label={`Перейти до слайду ${index + 1}`}
                    className={`h-2.5 w-2.5 rounded-full transition ${
                      index === currentDotIndex
                        ? 'bg-[#FF3D8C]'
                        : 'bg-[#FF3D8C]/45 hover:bg-[#FF3D8C]/75'
                    }`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}
