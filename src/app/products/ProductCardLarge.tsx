'use client'
import Link from 'next/link'
import Image from 'next/image'
import { Product } from '@/lib/products'

export default function ProductCardLarge({ p }: { p: Product }) {
  return (
    <Link href={`/products/${p.slug}`} className="block border overflow-hidden">
      {/* Image */}

      <div className="relative w-full h-[501px] bg-gray-100">
        <Image src={p.images[0]} alt={p.name} fill className="object-cover" />
      </div>
      {/* Description */}
      <div className="border-t px-3 py-2 flex items-center justify-between">
        <span className="text-sm md:text-base truncate">{p.name}</span>
        <span className="text-sm md:text-base whitespace-nowrap">
          {p.priceUAH} ₴
        </span>
      </div>
    </Link>
  )
}
