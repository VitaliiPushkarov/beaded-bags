// Product page
import Image from 'next/image'
import { getBySlug } from '@/lib/products'
import AddToCart from './AddToCart'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const p = getBySlug(slug)
  if (!p) return <div className="max-w-6xl mx-auto px-4 py-10">Не знайдено</div>

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-8">
      {/* Left column: Two main pictures */}
      <div className="space-y-5">
        {p.images.slice(0, 2).map((src, i) => (
          <div
            key={i}
            className="relative w-full aspect-[4/3] overflow-hidden rounded bg-gray-100"
          >
            <Image
              src={src}
              alt={p.name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {/* права колонка: інформація */}
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold leading-tight">{p.name}</h1>
        <div className="mt-2 text-gray-500 line-through hidden">9200 грн</div>
        <div className="mt-1 text-xl">{p.priceUAH} грн</div>

        <hr className="my-5" />

        {/* Color/options placeholder */}
        <div className="mb-4">
          <div className="text-sm text-gray-600 mb-2">Колір</div>
          <div className="flex gap-2">
            {['#f7c7d9', '#e19b49', '#3b6b37', '#2e4e3a'].map((c, i) => (
              <span
                key={i}
                style={{ background: c }}
                className="w-6 h-6 rounded-full border"
              />
            ))}
          </div>
        </div>

        <AddToCart p={p} />

        <div className="mt-5 text-sm text-gray-700 leading-relaxed">
          {p.description} Сумка з бісеру, лімітована серія. У наявності/під
          замовлення.
        </div>
      </div>
    </div>
  )
}
