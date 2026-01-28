'use client'

import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

const InstagramSliderInner = dynamic(() => import('./InstagramSliderInner'), {
  ssr: false,
})

const previewImages = [
  {
    src: '/img/instagram/inst1.jpg',
    href: 'https://www.instagram.com/p/DRsKzcsjNSG/',
    alt: 'Instagram Image 1',
  },
  {
    src: '/img/instagram/inst2.jpg',
    href: 'https://www.instagram.com/p/DRkWfJ1DIZo/',
    alt: 'Instagram Image 2',
  },
  {
    src: '/img/instagram/inst3.jpg',
    href: 'https://www.instagram.com/p/DRmxdVJDJ3L/?img_index=1',
    alt: 'Instagram Image 3',
  },
  {
    src: '/img/instagram/inst4.jpg',
    href: 'https://www.instagram.com/p/DRzpakajLzB/?img_index=1',
    alt: 'Instagram Image 4',
  },
]

export default function InstagramSlider() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    const el = containerRef.current
    const onActivate = () => setActive(true)

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setActive(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' },
    )

    io.observe(el)
    el.addEventListener('pointerdown', onActivate, { once: true })

    return () => {
      io.disconnect()
      el.removeEventListener('pointerdown', onActivate)
    }
  }, [])

  return (
    <section className="w-full py-8" ref={containerRef}>
      {active ? (
        <InstagramSliderInner />
      ) : (
        <div className="mx-auto">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {previewImages.map((img) => (
              <a
                key={img.src}
                href={img.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block shrink-0 w-[75%] sm:w-[48%] md:w-[24%]"
                aria-label="Перейти в Instagram"
              >
                <div className="relative w-full h-[360px] md:h-[420px] overflow-hidden bg-gray-100">
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    sizes="(max-width: 768px) 80vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover"
                    loading="lazy"
                  />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
