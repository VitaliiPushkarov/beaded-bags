import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import ProductForm from '../ProductsForm'
import type { ProductType, ProductGroup } from '@prisma/client'
import { resolveDiscountPercent } from '@/lib/pricing'
import { resolveAvailabilityStatus } from '@/lib/availability'

type PageProps = {
  params: Promise<{ id: string }>
}

function mapAddonLink(rel: {
  id: string
  sort: number | null
  addonVariantId: string
  addonVariant: {
    color: string | null
    priceUAH: number | null
    product: {
      name: string
      slug: string
      basePriceUAH: number | null
    }
  }
}) {
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

async function getAvailableAddonVariant(addonVariantId: string) {
  return prisma.productVariant.findFirst({
    where: {
      id: addonVariantId,
      inStock: true,
      availabilityStatus: 'IN_STOCK',
      product: {
        is: {
          isAddon: true,
          status: 'PUBLISHED',
          inStock: true,
        },
      },
    },
    select: { id: true },
  })
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
          straps: {
            orderBy: { sort: 'asc' },
          },
          pouches: {
            orderBy: { sort: 'asc' },
          },
          sizes: {
            orderBy: { sort: 'asc' },
          },
          addonsOnVariant: {
            where: {
              addonVariant: {
                is: {
                  inStock: true,
                  availabilityStatus: 'IN_STOCK',
                  product: {
                    is: {
                      isAddon: true,
                      status: 'PUBLISHED',
                      inStock: true,
                    },
                  },
                },
              },
            },
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
      status: 'PUBLISHED',
      inStock: true,
      variants: {
        some: {
          inStock: true,
          availabilityStatus: 'IN_STOCK',
        },
      },
    },
    orderBy: { name: 'asc' },
    include: {
      variants: {
        where: {
          inStock: true,
          availabilityStatus: 'IN_STOCK',
        },
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

    const targetVariant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId: id },
      select: { id: true },
    })
    if (!targetVariant) {
      throw new Error('Варіант товару недоступний для редагування')
    }

    const availableAddonVariant = await getAvailableAddonVariant(addonVariantId)

    if (!availableAddonVariant) {
      throw new Error('Обраний addon недоступний для додавання')
    }

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

    return mapAddonLink(rel)
  }

  async function upsertVariantAddonsBatch(input: {
    variantId: string
    addonVariantIds: string[]
    sort?: number
  }) {
    'use server'

    const variantId = String(input.variantId || '')
    const sort = Number(input.sort ?? 0) || 0
    const addonVariantIds = Array.from(
      new Set(
        (input.addonVariantIds || []).filter(
          (id): id is string => typeof id === 'string' && id.length > 0,
        ),
      ),
    )

    if (!variantId || addonVariantIds.length === 0) return []

    const targetVariant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId: id },
      select: { id: true },
    })
    if (!targetVariant) {
      throw new Error('Варіант товару недоступний для редагування')
    }

    const availableAddonVariants = await prisma.productVariant.findMany({
      where: {
        id: { in: addonVariantIds },
        inStock: true,
        availabilityStatus: 'IN_STOCK',
        product: {
          is: {
            isAddon: true,
            status: 'PUBLISHED',
            inStock: true,
          },
        },
      },
      select: { id: true },
    })

    const availableIds = new Set(availableAddonVariants.map((x) => x.id))
    const unavailable = addonVariantIds.filter((addonId) => !availableIds.has(addonId))
    if (unavailable.length > 0) {
      throw new Error('Деякі обрані addons недоступні для додавання')
    }

    const rels = await prisma.$transaction(
      addonVariantIds.map((addonVariantId) =>
        prisma.productVariantAddon.upsert({
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
        }),
      ),
    )

    return rels.map(mapAddonLink)
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
    type: (product.type === 'ORNAMENTS'
      ? 'ACCESSORY'
      : product.type) as ProductType,
    status: product.status,
    group: product.group as ProductGroup,
    sortCatalog: String(product.sortCatalog ?? 0),
    basePriceUAH: product.basePriceUAH?.toString() ?? '',
    description: product.description ?? '',
    info: product.info ?? '',
    dimensions: product.dimensions ?? '',
    offerNote: product.offerNote ?? '',
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
        modelSize: (v as any).modelSize ?? '',
        pouchColor: (v as any).pouchColor ?? '',
        hex: v.hex ?? '',
        image: main,
        images,
        priceUAH: v.priceUAH?.toString() ?? '',
        discountPercent: resolveDiscountPercent({
          basePriceUAH: v.priceUAH ?? product.basePriceUAH ?? 0,
          discountPercent: v.discountPercent,
          discountUAH: v.discountUAH,
        }).toString(),
        discountUAH: v.discountUAH?.toString() ?? '',
        shippingNote: v.shippingNote ?? '',
        availabilityStatus: resolveAvailabilityStatus({
          availabilityStatus: (v as any).availabilityStatus,
          inStock: v.inStock,
        }),
        inStock: v.inStock,
        sku: v.sku ?? '',
        straps:
          (v as any).straps?.map((s: any) => ({
            id: s.id,
            name: s.name ?? '',
            extraPriceUAH: String(s.extraPriceUAH ?? 0),
            sort: String(s.sort ?? 0),
            imageUrl: s.imageUrl ?? '',
          })) ?? [],
        pouches:
          (v as any).pouches?.map((pouch: any) => ({
            id: pouch.id,
            color: pouch.color ?? '',
            extraPriceUAH: String(pouch.extraPriceUAH ?? 0),
            sort: String(pouch.sort ?? 0),
            imageUrl: pouch.imageUrl ?? '',
          })) ?? [],
        sizes:
          (v as any).sizes?.map((size: any) => ({
            id: size.id,
            size: size.size ?? '',
            extraPriceUAH: String(size.extraPriceUAH ?? 0),
            sort: String(size.sort ?? 0),
            imageUrl: size.imageUrl ?? '',
          })) ?? [],
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
          upsertVariantAddonsBatch={upsertVariantAddonsBatch}
          updateVariantAddonSort={updateVariantAddonSort}
          deleteVariantAddon={deleteVariantAddon}
        />
      </div>
    </div>
  )
}
