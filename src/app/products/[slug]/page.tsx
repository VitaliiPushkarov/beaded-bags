import { PRODUCTS, type Product } from '@/lib/products'
import { ProductClient } from './ProductClient'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/ui/BreadCrumbs'

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
  const override = [
    { label: 'Головна', href: '/' },
    { label: 'Каталог', href: '/products' },

    ...(p?.type
      ? [
          {
            label: String(p.type),
            href: `/products?type=${encodeURIComponent(String(p.type))}`,
          },
        ]
      : []),
    { label: p?.name ?? 'Товар' },
  ]

  if (!p) {
    return <div className="max-w-6xl mx-auto px-4 py-10">Не знайдено</div>
  }

  return (
    <div className="max-w-[1440px] mx-auto py-10 px-[50px]">
      <Suspense fallback={null}>
        <Breadcrumbs override={override} />
      </Suspense>

      <ProductClient p={p} />
    </div>
  )
}
