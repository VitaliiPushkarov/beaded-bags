import { prisma } from '@/lib/prisma'
import ProductForm from '../ProductsForm'
import type { ProductType } from '@prisma/client'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function AdminProductEditPage({ params }: PageProps) {
  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: {
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!product) {
    return <div>Товар не знайдено</div>
  }

  const initial = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    type: product.type as ProductType,
    basePriceUAH: product.basePriceUAH?.toString() ?? '',
    description: product.description ?? '',
    inStock: product.inStock,
    variants: product.variants.map((v) => ({
      id: v.id,
      color: v.color ?? '',
      hex: v.hex ?? '',
      image: v.image ?? '',
      priceUAH: v.priceUAH?.toString() ?? '',
      inStock: v.inStock,
      sku: v.sku ?? '',
    })),
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Редагування товару</h1>
      <ProductForm mode="edit" initial={initial} />
    </div>
  )
}
