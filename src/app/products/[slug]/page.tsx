import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Suspense } from 'react'
import Breadcrumbs from '@/components/ui/BreadCrumbs'
import { ProductClient } from './ProductClient'
import { ProductType } from '@prisma/client'

const TYPE_TO_ROUTE: Record<ProductType, { label: string; href: string }> = {
  BAG: { label: 'Сумки', href: '/shop/sumky' },
  BELT_BAG: { label: 'Бананки', href: '/shop/bananky' },
  BACKPACK: { label: 'Рюкзачки', href: '/shop/rjukzachky' },
  SHOPPER: { label: 'Шопери', href: '/shop/shopery' },
  CASE: { label: 'Чохли', href: '/shop/chohly' },
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const p = await prisma.product.findUnique({
    where: { slug: slug },
    include: {
      variants: {
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!p) {
    return notFound()
  }

  const crumbs = [
    { label: 'Головна', href: '/' },
    { label: 'Каталог', href: '/shop' },
  ] as { label: string; href?: string }[]

  if (p.type && TYPE_TO_ROUTE[p.type]) {
    crumbs.push(TYPE_TO_ROUTE[p.type])
  }

  crumbs.push({ label: p.name || 'Товар' })

  return (
    <div className="max-w-[1440px] mx-auto py-10 px-[50px]">
      <Suspense fallback={null}>
        <Breadcrumbs override={crumbs} />
      </Suspense>
      <ProductClient p={p as any} />
    </div>
  )
}
