'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import type { HomeHeroSlideDTO } from '@/lib/home-hero-banner'

type Props = {
  slides: HomeHeroSlideDTO[]
  autoPlayMs?: number
}

export default function HeroBlockSlider({ slides, autoPlayMs = 7000 }: Props) {
  const ordered = useMemo(() => {
    const sorted = [...slides].sort(
      (a, b) => a.sort - b.sort || a.id.localeCompare(b.id),
    )
    const active = sorted.filter((slide) => slide.isActive)
    return active.length > 0 ? active : sorted
  }, [slides])

  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)
  }, [ordered.length])

  useEffect(() => {
    if (ordered.length <= 1) return

    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % ordered.length)
    }, autoPlayMs)

    return () => window.clearInterval(timer)
  }, [ordered.length, autoPlayMs])

  if (ordered.length === 0) return null

  return (
    <section className="relative w-full h-[600px] md:h-[740px] ">
      <div className="relative h-full px-6">
        <div className="relative h-full overflow-hidden">
          {ordered.map((slide, index) => {
            const isActive = index === activeIndex

            return (
              <Link
                key={slide.id}
                href={slide.linkHref}
                className={`absolute inset-0 block transition-opacity duration-500 ${
                  isActive
                    ? 'opacity-100 z-20'
                    : 'opacity-0 z-10 pointer-events-none'
                }`}
              >
                <Image
                  src={slide.mobileImage}
                  alt={slide.mobileAlt}
                  fill
                  loading={index === 0 ? 'eager' : 'lazy'}
                  sizes="100vw"
                  className="object-contain object-center md:hidden"
                  quality={60}
                />
                <Image
                  src={slide.desktopImage}
                  alt={slide.desktopAlt}
                  fill
                  priority={index === 0}
                  className="object-contain object-center hidden md:block"
                  quality={80}
                  sizes="100vw"
                />
              </Link>
            )
          })}

          {ordered.length > 1 ? (
            <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2">
              {ordered.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Перейти до слайду ${index + 1}`}
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    index === activeIndex
                      ? 'bg-white'
                      : 'bg-white/45 hover:bg-white/75'
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
