'use client'
import Image from 'next/image'
import Link from 'next/link'

type CallToActionProps = {
  image: string // /images/hero.jpg
  title: string // "GERDAN"
  subtitle?: string // "Ручні сумки з бісеру"
  ctaLabel?: string // "Дивитися колекцію"
  ctaHref?: string // "/products"
}

export default function CallToAction({
  image,
  title,
  subtitle = '',
  ctaLabel = 'Дивитися колекцію',
  ctaHref = '/products',
}: CallToActionProps) {
  return (
    <section className="relative mx-auto max-w-[1440px] px-[50px] py-10">
      <div className="relative h-[62vh] min-h-[420px] overflow-hidden">
        <Image src={image} alt={title} fill priority className="object-cover" />
        <div className="absolute inset-0 bg-black/15" />
        <div className="absolute left-8 right-8 bottom-8 md:left-10 md:right-auto md:bottom-10">
          <h1 className="font-fixel-display text-4xl md:text-5xl tracking-wide text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-white/90 text-base md:text-lg max-w-xl">
              {subtitle}
            </p>
          )}
          <Link
            href={ctaHref}
            className="mt-5 inline-flex items-center justify-center rounded bg-black text-white px-5 py-2 text-sm md:text-base hover:bg-[#FF3D8C] transition"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  )
}
