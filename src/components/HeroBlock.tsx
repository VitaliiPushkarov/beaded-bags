import Image from 'next/image'
import Link from 'next/link'

export default function HeroBlock() {
  return (
    <Link
      href="/shop"
      className="relative block w-full md:h-[90vh] h-[600px] overflow-hidden group cursor-pointer"
    >
      {/* Головне фото */}
      <Image
        src="/img/hero-block-01.png"
        alt="Gerdan Hero"
        fill
        priority
        className="object-cover object-center"
        quality={100}
      />

      {/* Лого поверх фото */}
      <div className="absolute bottom-10 right-10 md:bottom-16 md:right-16 w-[180px] md:w-[260px] lg:w-[320px]">
        <Image
          src="/img/hero-logo-gerdan-w.png"
          alt="GERDAN Logo"
          width={400}
          height={120}
          className="w-full h-auto object-contain"
          priority
        />
      </div>
    </Link>
  )
}
