import { getProducts } from '@/lib/db/products'
import ProductsContainer from '@/components/product/ProductsContainer'

export default async function ShopPage(props: {
  searchParams: Promise<{ q?: string; color?: string; type?: string }>
}) {
  const searchParams = await props.searchParams

  const products = await getProducts({
    search: searchParams.q,
    color: searchParams.color,
    type: searchParams.type as any,
  })

  return (
    <ProductsContainer
      initialProducts={products}
      initialFilters={{
        q: searchParams.q ?? '',
        color: searchParams.color ?? '',
        bagTypes: (searchParams.type as any) ?? '',
      }}
    />
  )
}
