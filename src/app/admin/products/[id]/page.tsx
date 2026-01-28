import { prisma } from '@/lib/prisma'
import Link from 'next/link'
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
          images: {
            orderBy: { sort: 'asc' },
          },
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
    })),
  )

  if (!product) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="border rounded bg-white p-4">
          <div className="text-lg font-medium">Товар не знайдено</div>
          <Link
            href="/admin/products"
            className="mt-2 inline-block underline text-sm"
          >
            ← Назад до товарів
          </Link>
        </div>
      </div>
    )
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
    variants: product.variants.map((v) => {
      const images =
        v.images
          ?.slice()
          .sort((a, b) => a.sort - b.sort)
          .map((x) => x.url) ?? []
      const main = v.image ?? images[0] ?? ''

      return {
        id: v.id,
        color: v.color ?? '',
        hex: v.hex ?? '',
        image: main,
        images,
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
      }
    }),
  }

  return (
    <div className=" mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
        <div>
          <Link href="/admin/products" className="text-sm underline">
            ← Назад до товарів
          </Link>
          <h1 className="mt-2 text-2xl font-semibold leading-tight">
            Редагування товару
          </h1>
          <div className="mt-1 text-sm text-gray-600 wrap-break-word">
            <span className="font-medium text-gray-800">{product.name}</span>
            <span className="mx-2 text-gray-400">•</span>
            <span>slug: {product.slug}</span>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <div>
            <span className="text-gray-500">ID:</span> {product.id}
          </div>
        </div>
      </div>

      <div className="my-6">
        <ProductForm
          mode="edit"
          initial={initial as any}
          addonVariantOptions={addonVariantOptions}
          upsertVariantAddon={upsertVariantAddon}
          updateVariantAddonSort={updateVariantAddonSort}
          deleteVariantAddon={deleteVariantAddon}
        />
      </div>
    </div>
  )
}
