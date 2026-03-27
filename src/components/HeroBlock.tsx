import Image from 'next/image'
import Link from 'next/link'

export default function HeroBlock() {
  return (
    <Link
      href="/shop"
      className="relative block w-full md:h-[90vh] h-[600px] overflow-hidden group cursor-pointer"
    >
      {/* Mobile */}
      <Image
        src="/img/hero-block-m.jpg"
        alt="Gerdan Hero Mobile"
        fill
        loading="eager"
        sizes="100vw"
        className="object-cover object-center md:hidden"
        quality={60}
      />
      {/* Головне фото */}
      <Image
        src="/img/hero-block-01.jpg"
        alt="Gerdan Hero"
        fill
        priority
        className="object-cover object-center hidden md:block"
        quality={80}
        sizes="100vw"
      />

      {/* Лого поверх фото */}
      <div className="absolute bottom-1/2 md:bottom-16 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0  md:right-16 w-[180px] md:w-[260px] lg:w-[320px]">
        <Image
          src="/img/hero-logo-gerdan-w.png"
          alt="GERDAN Logo"
          width={400}
          height={120}
          className="w-full h-auto object-contain"
        />
      </div>
    </Link>
  )
}
