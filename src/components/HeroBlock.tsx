import Image from 'next/image'
import Link from 'next/link'

export default function HeroBlock() {
  return (
    <Link
      href="/shop"
      className="relative block w-full h-[90vh] overflow-hidden group cursor-pointer"
    >
      {/* Фото */}
      <Image
        src="/img/hero-block.png"
        alt="Gerdan Hero"
        fill
        priority
        className="object-cover object-center"
        quality={100}
      />

      {/* Легка маска (можна забрати) */}
      {/* <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-all"></div> */}
    </Link>
  )
}
