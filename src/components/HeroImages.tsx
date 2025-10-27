'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { vi } from 'zod/locales'

type Props = {
  leftImg: string
  centerVideo: string // наприклад: "/media/hero.mp4"
  centerPoster?: string // "/media/hero-poster.jpg"
  rightImg: string
  altLeft?: string
  altRight?: string
}

export default function HeroSection({
  leftImg,
  centerVideo,
  centerPoster,
  rightImg,
  altLeft = '',
  altRight = '',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Автовідтворення лише коли секція в полі зору
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!el) return
        if (entry.isIntersecting) el.play().catch(() => {})
        else el.pause()
      },
      { threshold: 0.25 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section className="mx-auto max-w-full">
      <div
        className="
          flex md:flex-row lg:gap-[110px] md:gap-[50px] sm:gap-0
          justify-between
          items-center
          flex-col
        "
      >
        {/* Ліве фото */}
        <figure className="relative h-[600px] sm:h-[460px] lg:h-[610px] overflow-hidden 2xl:h-[780px] md:w-[460px] w-full">
          <Image
            src={leftImg}
            alt={altLeft}
            fill
            sizes="(max-width:768px) 100vw, 33vw"
            className="object-cover"
            priority={false}
          />
        </figure>

        {/* Центр — відео */}
        <figure className="relative h-[660px] sm:h-[520px] lg:h-[660px] overflow-hidden 2xl:h-[820px] lg:w-[420px] md:w-[320px] w-full">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            src={centerVideo}
            poster={centerPoster}
            muted
            playsInline
            loop
            preload="metadata"
            controls={false}
          />
        </figure>

        {/* Праве фото */}
        <figure className="relative h-[600px] sm:h-[460px] lg:h-[610px] lg:w-[460px] overflow-hidden 2xl:h-[780px] md:w-[460px] w-full">
          <Image
            src={rightImg}
            alt={altRight}
            fill
            sizes="(max-width:768px) 100vw, 33vw"
            className="object-cover"
          />
        </figure>
      </div>

      <div className="flex justify-center -mt-6 md:-mt-50">
        <Image
          className="z-10"
          src="/img/signature.png"
          alt="gerdan"
          width={652}
          height={266}
        />
      </div>
    </section>
  )
}

/* export default function HeroImages() {
  const pics = [
    '/img/hero-img-1.png',
    '/img/hero-img-2.png',
    '/img/hero-img-3.png',
  ]
  return (
    <section className="bg-white">
      <div className="max-w-full mx-auto px-4 py-12 md:py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {pics.map((src, i) => (
            <div
              key={i}
              className="relative aspect-[3/4] bg-gray-100 overflow-hidden"
            >
              <Image src={src} alt="look" fill className="object-cover" />
            </div>
          ))}
        </div>

        <div className="flex justify-center -mt-6 md:-mt-10">
          <Image
            className="z-10"
            src="/img/signature.png"
            alt="gerdan"
            width={360}
            height={120}
          />
        </div>
      </div>
    </section>
  )
}
 */
