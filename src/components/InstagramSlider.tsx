'use client'

import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n'
import type { InstagramPostDTO } from '@/lib/home-page-config'

const InstagramSliderInner = dynamic(() => import('./InstagramSliderInner'), {
  ssr: false,
})

export default function InstagramSlider({
  posts,
}: {
  posts: InstagramPostDTO[]
}) {
  const t = useT()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(false)
  const previewPosts = posts.slice(0, 4)

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
      <div className="mx-auto px-4 md:px-6 pb-4">
        <h2 className="text-2xl uppercase font-semibold">
          {t('МИ В INSTAGRAM', "We're on Instagram")}
        </h2>
      </div>

      {active ? (
        <InstagramSliderInner posts={posts} />
      ) : (
        <div className="mx-auto">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {previewPosts.map((img) => (
              <a
                key={img.id}
                href={img.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block shrink-0 w-[75%] sm:w-[48%] md:w-[24%]"
                aria-label={t('Перейти в Instagram', 'Open Instagram')}
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
