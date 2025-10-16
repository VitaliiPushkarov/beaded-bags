import { PRODUCTS, type Product } from '@/lib/products'
import { ProductClient } from './ProductClient'

function getBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug)
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const p = getBySlug(slug)

  if (!p) {
    return <div className="max-w-6xl mx-auto px-4 py-10">Не знайдено</div>
  }

  return <ProductClient p={p} />
}
