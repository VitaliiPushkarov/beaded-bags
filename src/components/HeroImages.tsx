'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

type Props = {
  leftImg: string
  centerVideo: string
  centerPoster?: string
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
  const [isMobile, setIsMobile] = useState(false)
  const [mobileVideoActive, setMobileVideoActive] = useState(false)

  // On mobile we don't load the hero video at all (poster only) to improve PSI.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => {
      const next = mq.matches
      setIsMobile(next)
      // If we leave mobile, reset the tap-to-play state
      if (!next) setMobileVideoActive(false)
    }
    update()

    // Safari < 14 fallback
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update)
      return () => mq.removeEventListener('change', update)
    }
    mq.addListener(update)
    return () => mq.removeListener(update)
  }, [])

  // Автовідтворення лише коли секція в полі зору (desktop/tablet only)
  useEffect(() => {
    if (isMobile) return
    const el = videoRef.current
    if (!el) return

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!el) return
        if (entry.isIntersecting) el.play().catch(() => {})
        else el.pause()
      },
      { threshold: 0.25 },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [isMobile])

  const activateMobileVideo = () => {
    setMobileVideoActive(true)
    // Start playback on the next tick after the <video> mounts
    requestAnimationFrame(() => {
      const el = videoRef.current
      if (!el) return
      el.play().catch(() => {
        // Autoplay can still be blocked in some cases; user can tap the native play control if needed.
      })
    })
  }

  return (
    <section className="mx-auto max-w-full relative">
      <div
        className="
          flex md:flex-row lg:gap-[110px] md:gap-[50px] sm:gap-0
          justify-between
          items-center
          flex-col
        "
      >
        {/* Ліве фото */}
        <figure className="relative h-[600px] sm:h-[460px] lg:h-[610px] 2xl:w-full overflow-hidden 2xl:h-[780px] md:w-[460px] w-full hidden md:block">
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
        <figure className="relative h-[660px] sm:h-[520px] lg:h-[660px] 2xl:w-[1400px] overflow-hidden 2xl:h-[820px] lg:w-[420px] md:w-[320px] w-full">
          {/* Mobile: poster first (no mp4). Tap to load + play video */}
          <div className="absolute inset-0 md:hidden">
            {!mobileVideoActive ? (
              <button
                type="button"
                onClick={activateMobileVideo}
                className="relative h-full w-full"
                aria-label="Play video"
              >
                <Image
                  src={centerPoster || leftImg}
                  alt=""
                  fill
                  priority
                  sizes="100vw"
                  className="object-cover"
                />
                {/* Play badge */}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex items-center justify-center w-14 h-14 rounded-full bg-black/55">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path d="M9 7L18 12L9 17V7Z" fill="white" />
                    </svg>
                  </span>
                </span>
              </button>
            ) : (
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                src={centerVideo}
                poster={centerPoster}
                muted
                playsInline
                loop
                preload="none"
                controls={false}
                // ensure playback starts even if RAF happens before media is ready
                onCanPlay={() => {
                  const el = videoRef.current
                  if (el && el.paused) el.play().catch(() => {})
                }}
              />
            )}
          </div>

          {/* Desktop/tablet: video (autoplay via IntersectionObserver) */}
          <video
            ref={videoRef}
            className="h-full w-full object-cover hidden md:block"
            src={centerVideo}
            poster={centerPoster}
            muted
            playsInline
            loop
            preload="none"
            controls={false}
          />
        </figure>

        {/* Праве фото */}
        <figure className="relative h-[600px] hidden md:block md:mt-0 sm:h-[460px] lg:h-[610px] lg:w-[460px] 2xl:w-full overflow-hidden 2xl:h-[780px] md:w-[460px] w-full">
          <Image
            src={rightImg}
            alt={altRight}
            fill
            sizes="(max-width:768px) 100vw, 33vw"
            className="object-cover"
          />
        </figure>
      </div>

      <div className="md:w-[652px] md:h-[266px] w-[320px] h-[266px] top-80 absolute left-1/2 md:top-11/12 -translate-x-1/2 md:-translate-y-1/3 md:-mt-[150px] overflow-hidden">
        <Image
          className="z-10 h-full w-full"
          src="/img/signature.png"
          alt="gerdan"
          width={100}
          height={100}
          sizes="(max-width: 768px) 90vw, 360px"
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
