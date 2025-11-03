import ProductCardLarge from '@/app/products/ProductCardLarge'
import { Product, ProductVariant } from '@prisma/client'

type ProductWithVariants = Product & {
  variants: ProductVariant[]
}

export default function ProductsGrid({
  products,
  loading,
}: {
  products: ProductWithVariants[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse bg-gray-200 h-[400px] rounded-md"
          ></div>
        ))}
      </div>
    )
  }

  if (!products.length) {
    return (
      <div className="text-gray-500 mt-6">
        За вашим запитом нічого не знайдено.
      </div>
    )
  }
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
      {products.map((p) => (
        <ProductCardLarge key={p.id || p.slug} p={p} />
      ))}
    </div>
  )
}
