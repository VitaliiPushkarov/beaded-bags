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

  const [activeIndex, setActiveIndex] = useState(0)
  const [isAutoPlayEnabled, setIsAutoPlayEnabled] = useState(true)
  const touchStartXRef = useRef<number | null>(null)
  const touchEndXRef = useRef<number | null>(null)

  useEffect(() => {
    setActiveIndex(0)
  }, [ordered.length])

  useEffect(() => {
    if (!isAutoPlayEnabled || ordered.length <= 1) return

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % ordered.length)
    }, autoPlayMs)

    return () => window.clearInterval(timer)
  }, [ordered.length, autoPlayMs, isAutoPlayEnabled])

  if (ordered.length === 0) return null

  const SWIPE_THRESHOLD = 40
  const stopAutoPlay = () => setIsAutoPlayEnabled(false)

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + ordered.length) % ordered.length)
  }

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % ordered.length)
  }

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    stopAutoPlay()
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

  return (
    <section className="relative w-full">
      <div className="relative px-0 md:px-6">
        <div
          className="relative"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="md:hidden overflow-hidden">
            <div
              className="flex transition-transform duration-700 ease-in-out"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              {ordered.map((slide, index) => (
                <Link
                  key={slide.id}
                  href={slide.linkHref}
                  className="block w-full shrink-0"
                >
                  <Image
                    src={slide.mobileImage}
                    alt={slide.mobileAlt}
                    width={1200}
                    height={1800}
                    priority={index === 0}
                    className="w-full h-auto object-contain"
                    sizes="100vw"
                    quality={60}
                  />
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden md:block overflow-hidden">
            <div
              className="flex transition-transform duration-700 ease-in-out"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              {ordered.map((slide, index) => (
                <Link
                  key={slide.id}
                  href={slide.linkHref}
                  className="block w-full shrink-0"
                >
                  <Image
                    src={slide.desktopImage}
                    alt={slide.desktopAlt}
                    width={2880}
                    height={1440}
                    priority={index === 0}
                    className="w-full h-auto object-contain"
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
                  stopAutoPlay()
                  goPrev()
                }}
                aria-label="Previous"
                className="absolute left-2 md:-left-4 top-1/2 -translate-y-1/2 z-20 h-7 w-[21px] hidden md:flex items-center justify-center text-[#FF3D8C] hover:opacity-80 transition cursor-pointer"
              ></button>
              <button
                type="button"
                onClick={() => {
                  stopAutoPlay()
                  goNext()
                }}
                aria-label="Next"
                className="absolute right-2 md:-right-4 top-1/2 -translate-y-1/2 z-20 h-7 w-[21px] hidden md:flex items-center justify-center text-[#FF3D8C] hover:opacity-80 transition cursor-pointer"
              >
                <Chevron dir="right" className="h-7 w-[21px]" />
              </button>

              <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2">
                {ordered.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => {
                      stopAutoPlay()
                      setActiveIndex(index)
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
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}
