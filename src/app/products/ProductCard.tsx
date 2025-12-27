'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/app/store/cart'
import { useUI } from '../store/ui'

type ProductCardProps = {
  product: {
    id: string
    slug: string
    name: string
    basePriceUAH: number | null
    mainImage?: string | null
    images?: string[] | null
    variants?: {
      id: string
      image: string | null
      inStock: boolean
      priceUAH: number | null
      color: string | null
      hex: string | null
    }[]
  }
}

export default function ProductCard({ product }: ProductCardProps) {
  const add = useCart((s) => s.add)
  const openCart = useUI((s) => s.openCart)

  const firstVariant = product.variants?.[0]
  const price = firstVariant?.priceUAH ?? product.basePriceUAH ?? 0

  const img =
    product.mainImage ||
    (product.images && product.images[0]) ||
    firstVariant?.image ||
    '/img/placeholder.png'

  return (
    <article className="border rounded overflow-hidden bg-white flex flex-col">
      <Link
        href={`/products/${product.slug}`}
        className="block relative h-80 bg-gray-100"
      >
        <Image
          src={img}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 320px"
        />
      </Link>
      <div className="p-3 flex-1 flex flex-col gap-2">
        <Link
          href={`/products/${product.slug}`}
          className="text-sm font-medium line-clamp-2"
        >
          {product.name}
        </Link>
        <div className="text-sm text-gray-700">
          {price.toLocaleString('uk-UA')} ₴
        </div>
        <button
          onClick={() => {
            const item = {
              productId: product.id,
              variantId: firstVariant?.id ?? '',
              name: product.name,
              priceUAH: price,
              image: img,
              qty: 1,
              slug: product.slug,
              strapName: null,
            }

            add(item)
            openCart()
          }}
          className="mt-auto inline-flex items-center justify-center rounded bg-black text-white py-2 text-sm hover:bg-[#FF3D8C] transition"
        >
          Додати в кошик
        </button>
      </div>
    </article>
  )
}
