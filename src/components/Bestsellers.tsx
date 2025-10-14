import Image from 'next/image'
import Link from 'next/link'
import { PRODUCTS } from '@/lib/products'

export default function Bestsellers() {
  const list = PRODUCTS.slice(0, 8)
  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h3 className="text-sm font-semibold tracking-wider mb-4">
          БЕСТСЕЛЕРИ
        </h3>

        <div className="relative">
          <div className="flex gap-5 overflow-x-auto snap-x pb-2">
            {list.map((p) => (
              <div key={p.id} className="min-w-[260px] snap-start">
                <Link href={`/products/${p.slug}`}>
                  <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden border-1">
                    <Image
                      src={p.images[0]}
                      alt={p.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-sm">{p.name}</div>
                    <div className="text-sm text-gray-700">
                      {p.priceUAH} грн
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
