import { Suspense } from 'react'
import { getProducts } from '@/lib/db/products'
import ProductsInner from '@/components/product/ProductsInner'
import { toDbTypePrisma } from '@/lib/labels'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; color?: string }>
}) {
  const sp = await searchParams
  const typeNorm = toDbTypePrisma(sp.type)

  const initial = await getProducts({
    search: sp.q,
    type: typeNorm,
    color: sp.color,
  })

  return (
    <Suspense
      fallback={<div className="py-20 text-center">Завантаження...</div>}
    >
      <ProductsInner initialProducts={initial as any} />
    </Suspense>
  )
}
