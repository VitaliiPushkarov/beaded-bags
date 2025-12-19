import { prisma } from '@/lib/prisma'
import ProductForm from '../ProductsForm'
import type { ProductType, ProductGroup } from '@prisma/client'

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
        include: {
          addonsOnVariant: {
            orderBy: { sort: 'asc' },
            include: {
              addonVariant: {
                include: {
                  product: true,
                  images: true,
                },
              },
            },
          },
        },
      },
    },
  })

  const addonProducts = await prisma.product.findMany({
    where: {
      isAddon: true,
    },
    orderBy: { name: 'asc' },
    include: {
      variants: {
        orderBy: { id: 'asc' },
        include: {
          images: true,
        },
      },
    },
  })

  const addonVariantOptions = addonProducts.flatMap((p) =>
    p.variants.map((v) => ({
      id: v.id,
      productId: p.id,
      productName: p.name,
      productSlug: p.slug,
      color: v.color ?? '',
      priceUAH: v.priceUAH ?? p.basePriceUAH ?? 0,
      imageUrl:
        v.images?.slice().sort((a, b) => a.sort - b.sort)[0]?.url ||
        v.image ||
        '',
    }))
  )

  if (!product) {
    return <div>Товар не знайдено</div>
  }

  async function upsertVariantAddon(input: {
    variantId: string
    addonVariantId: string
    sort?: number
  }) {
    'use server'
    const { variantId, addonVariantId } = input
    const sort = Number(input.sort ?? 0) || 0

    const rel = await prisma.productVariantAddon.upsert({
      where: {
        variantId_addonVariantId: { variantId, addonVariantId },
      },
      create: { variantId, addonVariantId, sort },
      update: { sort },
      include: {
        addonVariant: {
          include: {
            product: true,
          },
        },
      },
    })

    return {
      id: rel.id,
      sort: rel.sort ?? 0,
      addonVariantId: rel.addonVariantId,
      addonProductName: rel.addonVariant.product.name,
      addonProductSlug: rel.addonVariant.product.slug,
      addonColor: rel.addonVariant.color ?? '',
      addonPriceUAH:
        rel.addonVariant.priceUAH ?? rel.addonVariant.product.basePriceUAH ?? 0,
    }
  }

  async function updateVariantAddonSort(input: { id: string; sort: number }) {
    'use server'
    const rel = await prisma.productVariantAddon.update({
      where: { id: input.id },
      data: { sort: Number(input.sort) || 0 },
      include: {
        addonVariant: {
          include: {
            product: true,
          },
        },
      },
    })

    return {
      id: rel.id,
      sort: rel.sort ?? 0,
      addonVariantId: rel.addonVariantId,
      addonProductName: rel.addonVariant.product.name,
      addonProductSlug: rel.addonVariant.product.slug,
      addonColor: rel.addonVariant.color ?? '',
      addonPriceUAH:
        rel.addonVariant.priceUAH ?? rel.addonVariant.product.basePriceUAH ?? 0,
    }
  }

  async function deleteVariantAddon(input: { id: string }) {
    'use server'
    await prisma.productVariantAddon.delete({ where: { id: input.id } })
    return { ok: true as const }
  }

  const initial = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    type: product.type as ProductType,
    group: product.group as ProductGroup,
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
      addons:
        (v as any).addonsOnVariant?.map((rel: any) => ({
          id: rel.id,
          sort: rel.sort ?? 0,
          addonVariantId: rel.addonVariantId,
          addonProductName: rel.addonVariant?.product?.name ?? '',
          addonProductSlug: rel.addonVariant?.product?.slug ?? '',
          addonColor: rel.addonVariant?.color ?? '',
          addonPriceUAH:
            rel.addonVariant?.priceUAH ??
            rel.addonVariant?.product?.basePriceUAH ??
            0,
        })) ?? [],
    })),
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Редагування товару</h1>
      <ProductForm
        mode="edit"
        initial={initial as any}
        addonVariantOptions={addonVariantOptions}
        upsertVariantAddon={upsertVariantAddon}
        updateVariantAddonSort={updateVariantAddonSort}
        deleteVariantAddon={deleteVariantAddon}
      />
    </div>
  )
}
