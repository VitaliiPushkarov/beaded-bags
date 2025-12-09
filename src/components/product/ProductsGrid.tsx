import ProductCardLarge, {
  ProductWithVariants as ProductsGridWithVariants,
} from '@/app/products/ProductCardLarge'

type ProductWithVariants = ProductsGridWithVariants

export default function ProductsGrid({
  products,
  loading,
}: {
  products: ProductWithVariants[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
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
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
      {products.map((p) => (
        <ProductCardLarge key={p.id || p.slug} p={p} />
      ))}
    </div>
  )
}
