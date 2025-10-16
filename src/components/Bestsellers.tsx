import Image from 'next/image'
import Link from 'next/link'
import { PRODUCTS } from '@/lib/products'

export default function Bestsellers() {
  const list = PRODUCTS.slice(0, 8)
  return (
    <section className="mx-auto py-12">
      <div className=" max-w-[1440px] px-4 sm:px-6 lg:px-[50px]">
        <h2 className="text-2xl font-semibold mb-5">БЕСТСЕЛЕРИ</h2>

        <div className="relative">
          <div className="flex gap-5 overflow-x-auto snap-x pb-2">
            {list.map((p) => (
              <div key={p.productId} className="min-w-[260px] snap-start">
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
                      {p.basePriceUAH} грн
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
