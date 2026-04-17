import ProductCardLarge, {
  ProductWithVariants as ProductsGridWithVariants,
} from '@/app/products/ProductCardLarge'
import { useT } from '@/lib/i18n'

type ProductWithVariants = ProductsGridWithVariants

export default function ProductsGrid({
  products,
  loading,
  preferredColor,
}: {
  products: ProductWithVariants[]
  loading: boolean
  preferredColor?: string
}) {
  const t = useT()
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
        {t('За вашим запитом нічого не знайдено.', 'No products found.')}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
      {products.map((p) => (
        <ProductCardLarge
          key={p.id || p.slug}
          p={p}
          preferredColor={preferredColor}
        />
      ))}
    </div>
  )
}
