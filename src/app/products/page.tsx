// Catalog page
import { PRODUCTS } from '@/lib/products'
import ProductCard from './ProductCard'

export default function ProductsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {PRODUCTS.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  )
}
