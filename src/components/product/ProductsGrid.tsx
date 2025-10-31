import ProductCardLarge from '@/app/products/ProductCardLarge'

export default function ProductsGrid({ products }: { products: any[] }) {
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
