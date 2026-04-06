import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ChevronDown } from 'lucide-react'
import { MaterialCategory } from '@prisma/client'

import MaterialsBulkCreateForm from '@/components/admin/MaterialsBulkCreateForm'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatUAH } from '@/lib/admin-finance'
import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'
import { TYPE_LABELS } from '@/lib/labels'
import { DEFAULT_PACKAGING_TEMPLATE_PRESETS } from '@/lib/management-accounting'
import {
  getMaterialCategoryLabel,
  materialCategoryToSlug,
  MATERIAL_CATEGORIES,
  getMaterialCategoryDefaultUnit,
} from '@/lib/material-categories'
import type { MaterialsBulkCreateActionResult } from '@/lib/admin-materials'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    q?: string
    productId?: string
    packagingOpen?: string
    editPackagingId?: string
    recentAddedDate?: string
    recentAddedFrom?: string
    recentAddedTo?: string
  }>
}

type InventoryView = 'overview' | 'products' | 'packaging' | 'materials'

const MaterialBulkItemSchema = z.object({
  name: z.string().trim().min(2),
  category: z.nativeEnum(MaterialCategory),
  unit: z.string().trim().min(1).max(20),
  color: z.string().trim().max(80).default(''),
  stockQty: z.coerce.number().min(0).default(0),
  unitCostUAH: z.coerce.number().min(0).default(0),
})

const MaterialBulkPayloadSchema = z.object({
  items: z.array(MaterialBulkItemSchema).min(1).max(50),
})

const VariantInventorySchema = z.object({
  variantId: z.string().min(1),
  finishedGoodsQty: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().optional(),
})

const PackagingTemplateSchema = z.object({
  name: z.string().trim().min(2),
  costUAH: z.coerce.number().int().min(0).default(0),
  boxLabel: z.string().trim().optional(),
  tissuePaperQty: z.coerce.number().int().min(0).default(0),
  tagCardQty: z.coerce.number().int().min(0).default(0),
  tagThreadQty: z.coerce.number().int().min(0).default(0),
  roundStickerQty: z.coerce.number().int().min(0).default(0),
  squareStickerQty: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().optional(),
})

const UpdatePackagingTemplateSchema = PackagingTemplateSchema.extend({
  id: z.string().min(1),
})

const AssignPackagingTemplateSchema = z.object({
  productId: z.string().min(1),
  packagingTemplateId: z.string().optional(),
})

function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (Number.isInteger(value)) return String(value)
  return value.toLocaleString('uk-UA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

function parseDateParam(value?: string): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

const INVENTORY_VIEW_PATHS: Record<InventoryView, string> = {
  overview: '/admin/inventory',
  products: '/admin/inventory/products',
  packaging: '/admin/inventory/packaging',
  materials: '/admin/inventory/materials',
}

function revalidateInventoryViews() {
  for (const path of Object.values(INVENTORY_VIEW_PATHS)) {
    revalidatePath(path)
  }
}

function normalizeMaterialInput(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function toMaterialMatchKey(input: {
  name: string
  category: MaterialCategory
  color: string
}): string {
  return [
    normalizeMaterialInput(input.name).toLowerCase(),
    input.category,
    normalizeMaterialInput(input.color).toLowerCase(),
  ].join('::')
}

export default async function InventoryPageView({
  searchParams,
  view = 'overview',
}: PageProps & { view?: InventoryView }) {
  const params = await searchParams
  const query = params.q?.trim() ?? ''
  const focusedProductId = params.productId?.trim() ?? ''
  const packagingOpen = params.packagingOpen === '1'
  const editPackagingId = params.editPackagingId?.trim() ?? ''
  const recentAddedDate = params.recentAddedDate?.trim() ?? ''
  const recentAddedFrom = params.recentAddedFrom?.trim() ?? ''
  const recentAddedTo = params.recentAddedTo?.trim() ?? ''
  const basePath = INVENTORY_VIEW_PATHS[view]
  const showProductsSection = view === 'products'
  const showPackagingSection = view === 'packaging'
  const showMaterialsSection = view === 'materials'
  const pageTitle =
    view === 'products'
      ? 'Товари'
      : view === 'packaging'
        ? 'Пакування'
        : view === 'materials'
          ? 'Матеріали'
          : 'Огляд'

  function buildInventoryHref(input?: {
    packagingOpen?: boolean
    editPackagingId?: string
  }) {
    const qs = new URLSearchParams()
    if (query) qs.set('q', query)
    if (focusedProductId) qs.set('productId', focusedProductId)
    if (input?.packagingOpen) qs.set('packagingOpen', '1')
    if (input?.editPackagingId) qs.set('editPackagingId', input.editPackagingId)

    const queryString = qs.toString()
    return queryString ? `${basePath}?${queryString}` : basePath
  }

  function buildVariantMaterialsHref(productId: string, variantId: string) {
    return `/admin/inventory/products/${productId}/variants/${variantId}`
  }

  async function createMaterialsBulk(
    formData: FormData,
  ): Promise<MaterialsBulkCreateActionResult> {
    'use server'

    const rawPayload = String(formData.get('payload') || '')
    let decodedPayload: unknown = null

    try {
      decodedPayload = JSON.parse(rawPayload)
    } catch {
      throw new Error('Некоректний формат пакету матеріалів')
    }

    const parsed = MaterialBulkPayloadSchema.safeParse(decodedPayload)

    if (!parsed.success) {
      throw new Error('Не вдалося створити матеріали')
    }

    const normalizedItems = parsed.data.items.map((item) => ({
      ...item,
      name: normalizeMaterialInput(item.name),
      color: normalizeMaterialInput(item.color),
      unit: normalizeMaterialInput(item.unit),
    }))

    const uniqueKeys = new Set<string>()
    for (const item of normalizedItems) {
      const dedupeKey = toMaterialMatchKey(item)
      if (uniqueKeys.has(dedupeKey)) {
        throw new Error(
          'У формі є дублікати матеріалів з однаковими категорією і кольором',
        )
      }
      uniqueKeys.add(dedupeKey)
    }

    const existingMaterials = await prisma.material.findMany({
      where: {
        OR: normalizedItems.map((item) => ({
          category: item.category,
          name: {
            equals: item.name,
            mode: 'insensitive',
          },
          color: {
            equals: item.color,
            mode: 'insensitive',
          },
        })),
      },
      select: {
        id: true,
        name: true,
        category: true,
        color: true,
      },
    })

    const existingByKey = new Map<
      string,
      Array<{
        id: string
        name: string
        category: MaterialCategory
        color: string
      }>
    >()
    for (const material of existingMaterials) {
      const key = toMaterialMatchKey(material)
      const rows = existingByKey.get(key) ?? []
      rows.push(material)
      existingByKey.set(key, rows)
    }

    const toCreate = normalizedItems.filter(
      (item) =>
        (existingByKey.get(toMaterialMatchKey(item)) ?? []).length === 0,
    )

    if (toCreate.length > 0) {
      await prisma.$transaction(
        toCreate.map((item) =>
          prisma.material.create({
            data: {
              name: item.name,
              category: item.category,
              color: item.color,
              unit: item.unit,
              stockQty: item.stockQty,
              unitCostUAH: item.unitCostUAH,
            },
          }),
        ),
      )

      revalidateInventoryViews()
      revalidatePath('/admin/costs')
      revalidatePath('/admin/finance')
      revalidatePath('/admin/inventory/materials')
      for (const category of MATERIAL_CATEGORIES) {
        revalidatePath(
          `/admin/inventory/materials/${materialCategoryToSlug(category)}`,
        )
      }
    }

    const created = toCreate.map((item, index) => {
      const searchQuery = item.name.trim()
      const queryString = searchQuery
        ? `?q=${encodeURIComponent(searchQuery)}`
        : ''
      return {
        id: `created-${index}-${toMaterialMatchKey(item)}`,
        name: item.name,
        color: item.color,
        category: item.category,
        href: `/admin/inventory/materials/${materialCategoryToSlug(item.category)}${queryString}`,
      }
    })

    const existing = existingMaterials.map((material) => {
      const searchQuery = material.name.trim()
      const queryString = searchQuery
        ? `?q=${encodeURIComponent(searchQuery)}`
        : ''
      return {
        id: material.id,
        name: material.name,
        color: material.color,
        category: material.category,
        href: `/admin/inventory/materials/${materialCategoryToSlug(material.category)}${queryString}`,
      }
    })

    return {
      createdCount: created.length,
      existingCount: existing.length,
      created,
      existing,
    }
  }

  async function createPackagingTemplate(formData: FormData) {
    'use server'

    const parsed = PackagingTemplateSchema.safeParse({
      name: formData.get('name'),
      costUAH: formData.get('costUAH'),
      boxLabel: formData.get('boxLabel'),
      tissuePaperQty: formData.get('tissuePaperQty'),
      tagCardQty: formData.get('tagCardQty'),
      tagThreadQty: formData.get('tagThreadQty'),
      roundStickerQty: formData.get('roundStickerQty'),
      squareStickerQty: formData.get('squareStickerQty'),
      notes: formData.get('notes'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося створити шаблон пакування')
    }

    await prisma.packagingTemplate.create({
      data: {
        ...parsed.data,
        boxLabel: parsed.data.boxLabel || null,
        notes: parsed.data.notes || null,
      },
    })

    revalidateInventoryViews()
    revalidatePath('/admin/costs')
    revalidatePath('/admin/finance')
  }

  async function updatePackagingTemplate(formData: FormData) {
    'use server'

    const parsed = UpdatePackagingTemplateSchema.safeParse({
      id: formData.get('id'),
      name: formData.get('name'),
      costUAH: formData.get('costUAH'),
      boxLabel: formData.get('boxLabel'),
      tissuePaperQty: formData.get('tissuePaperQty'),
      tagCardQty: formData.get('tagCardQty'),
      tagThreadQty: formData.get('tagThreadQty'),
      roundStickerQty: formData.get('roundStickerQty'),
      squareStickerQty: formData.get('squareStickerQty'),
      notes: formData.get('notes'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося оновити шаблон пакування')
    }

    await prisma.packagingTemplate.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        costUAH: parsed.data.costUAH,
        boxLabel: parsed.data.boxLabel || null,
        tissuePaperQty: parsed.data.tissuePaperQty,
        tagCardQty: parsed.data.tagCardQty,
        tagThreadQty: parsed.data.tagThreadQty,
        roundStickerQty: parsed.data.roundStickerQty,
        squareStickerQty: parsed.data.squareStickerQty,
        notes: parsed.data.notes || null,
      },
    })

    revalidateInventoryViews()
    revalidatePath('/admin/costs')
    revalidatePath('/admin/finance')
  }

  async function deletePackagingTemplate(formData: FormData) {
    'use server'

    const id = String(formData.get('id') || '')
    if (!id) return

    await prisma.packagingTemplate.delete({
      where: { id },
    })

    revalidateInventoryViews()
    revalidatePath('/admin/costs')
    revalidatePath('/admin/finance')
  }

  async function seedDefaultPackagingTemplates() {
    'use server'

    for (const template of DEFAULT_PACKAGING_TEMPLATE_PRESETS) {
      await prisma.packagingTemplate.upsert({
        where: { name: template.name },
        update: {
          costUAH: template.costUAH,
          boxLabel: template.boxLabel,
          tissuePaperQty: template.tissuePaperQty,
          tagCardQty: template.tagCardQty,
          tagThreadQty: template.tagThreadQty,
          roundStickerQty: template.roundStickerQty,
          squareStickerQty: template.squareStickerQty,
          notes: template.notes,
        },
        create: {
          ...template,
        },
      })
    }

    revalidateInventoryViews()
    revalidatePath('/admin/costs')
    revalidatePath('/admin/finance')
  }

  async function assignProductPackagingTemplate(formData: FormData) {
    'use server'

    const parsed = AssignPackagingTemplateSchema.safeParse({
      productId: formData.get('productId'),
      packagingTemplateId: String(formData.get('packagingTemplateId') || ''),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося прив’язати шаблон пакування')
    }

    const packagingTemplateId = parsed.data.packagingTemplateId?.trim() || null

    await prisma.product.update({
      where: { id: parsed.data.productId },
      data: { packagingTemplateId },
    })

    revalidateInventoryViews()
    revalidatePath('/admin/costs')
    revalidatePath('/admin/finance')
  }

  async function updateVariantInventory(formData: FormData) {
    'use server'

    const parsed = VariantInventorySchema.safeParse({
      variantId: formData.get('variantId'),
      finishedGoodsQty: formData.get('finishedGoodsQty'),
      notes: formData.get('notes'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося оновити запас варіанту')
    }

    await prisma.productVariantInventory.upsert({
      where: { variantId: parsed.data.variantId },
      create: {
        variantId: parsed.data.variantId,
        finishedGoodsQty: parsed.data.finishedGoodsQty,
        notes: parsed.data.notes || null,
      },
      update: {
        finishedGoodsQty: parsed.data.finishedGoodsQty,
        notes: parsed.data.notes || null,
      },
    })

    revalidateInventoryViews()
  }

  if (view === 'overview') {
    const [
      totalProducts,
      totalMaterials,
      totalMaterialLinks,
      finishedGoodsAggregate,
      variants,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.material.count(),
      prisma.productMaterial.count(),
      prisma.productVariantInventory.aggregate({
        _sum: {
          finishedGoodsQty: true,
        },
      }),
      prisma.productVariant.findMany({
        where: query
          ? {
              OR: [
                { color: { contains: query, mode: 'insensitive' } },
                { product: { name: { contains: query, mode: 'insensitive' } } },
                { product: { slug: { contains: query, mode: 'insensitive' } } },
              ],
            }
          : undefined,
        orderBy: [
          { product: { sortCatalog: 'asc' } },
          { sortCatalog: 'asc' },
          { id: 'asc' },
        ],
        select: {
          id: true,
          color: true,
          image: true,
          productId: true,
          product: {
            select: {
              name: true,
              slug: true,
              type: true,
            },
          },
          inventory: {
            select: {
              finishedGoodsQty: true,
              notes: true,
            },
          },
          images: {
            orderBy: { sort: 'asc' },
            select: { url: true },
            take: 1,
          },
        },
      }),
    ])

    const totalFinishedGoods = finishedGoodsAggregate._sum.finishedGoodsQty ?? 0

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{pageTitle}</h1>
          <p className="mt-1 text-sm text-gray-600">
            Короткий зріз запасів по товарах та виробничих матеріалах.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded border bg-white p-4">
            <div className="text-sm text-gray-500">Товарів у системі</div>
            <div className="mt-2 text-2xl font-semibold">{totalProducts}</div>
          </div>
          <div className="rounded border bg-white p-4">
            <div className="text-sm text-gray-500">
              Готових одиниць на складі
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {formatQuantity(totalFinishedGoods)}
            </div>
          </div>
          <div className="rounded border bg-white p-4">
            <div className="text-sm text-gray-500">Матеріалів у довіднику</div>
            <div className="mt-2 text-2xl font-semibold">{totalMaterials}</div>
          </div>
          <div className="rounded border bg-white p-4">
            <div className="text-sm text-gray-500">
              Прив’язок матеріалів до товарів
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {formatQuantity(totalMaterialLinks)}
            </div>
          </div>
        </section>

        <section className="rounded border bg-white">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-medium">Товари і запаси</h2>
              <p className="mt-1 text-sm text-gray-600">
                Оновлюй кількість готових одиниць по кожному варіанту.
              </p>
            </div>

            <form method="get" className="flex flex-col gap-3 sm:flex-row">
              <label className="text-sm font-medium">
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder="Пошук товару / кольору"
                  className="mt-2 w-full rounded-lg border px-3 py-2 text-sm sm:w-72"
                />
              </label>
              <div className="flex items-end gap-3">
                <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
                  Оновити
                </button>
                <Link
                  href={INVENTORY_VIEW_PATHS.overview}
                  className="inline-flex items-center justify-center rounded border px-4 py-2 text-sm"
                >
                  Скинути
                </Link>
              </div>
            </form>
          </div>

          {variants.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">
              За поточним фільтром варіанти не знайдені.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left">Товар / варіант</th>
                    <th className="p-3 text-left">Колір</th>
                    <th className="p-3 text-left">Запас</th>
                    <th className="p-3 text-right">Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((variant) => {
                    const imageUrl =
                      variant.images[0]?.url ||
                      variant.image ||
                      '/img/placeholder.png'
                    const currentQty = variant.inventory?.finishedGoodsQty ?? 0
                    const inventoryNotes = variant.inventory?.notes ?? ''
                    const colorLabel = variant.color?.trim() || 'Без кольору'

                    return (
                      <tr key={variant.id} className="border-t align-top">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 overflow-hidden rounded-full border bg-gray-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imageUrl}
                                alt={variant.product.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <div>
                              <div className="font-medium">
                                {variant.product.name}
                              </div>
                              <div className="mt-0.5 text-xs text-gray-500">
                                {TYPE_LABELS[variant.product.type]}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                            {colorLabel}
                          </span>
                        </td>
                        <td className="p-3">
                          <form
                            action={updateVariantInventory}
                            className="flex min-w-[220px] items-center gap-2"
                          >
                            <input
                              type="hidden"
                              name="variantId"
                              value={variant.id}
                            />
                            <input
                              type="hidden"
                              name="notes"
                              value={inventoryNotes}
                            />
                            <input
                              name="finishedGoodsQty"
                              type="number"
                              min="0"
                              defaultValue={currentQty}
                              className="w-full rounded-lg border px-3 py-2 text-sm"
                            />
                            <button className="inline-flex items-center justify-center rounded border px-3 py-2 text-xs hover:bg-gray-50">
                              Зберегти
                            </button>
                          </form>
                        </td>
                        <td className="p-3 text-right">
                          <Link
                            href={`${INVENTORY_VIEW_PATHS.products}?productId=${variant.productId}#product-${variant.productId}`}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Картка товару
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    )
  }

  const [materials, packagingTemplates, products] = await Promise.all([
    prisma.material.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            productUsages: true,
          },
        },
      },
    }),
    prisma.packagingTemplate.findMany({
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { slug: { contains: query, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ sortCatalog: 'asc' }, { createdAt: 'desc' }],
      include: {
        packagingTemplate: true,
        variants: {
          orderBy: [{ sortCatalog: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            color: true,
            image: true,
            inventory: {
              select: {
                finishedGoodsQty: true,
                notes: true,
              },
            },
            images: {
              orderBy: { sort: 'asc' },
              select: { url: true },
              take: 1,
            },
          },
        },
      },
    }),
  ])

  const totalFinishedGoods = products.reduce(
    (sum, product) =>
      sum +
      product.variants.reduce(
        (variantSum, variant) =>
          variantSum + (variant.inventory?.finishedGoodsQty ?? 0),
        0,
      ),
    0,
  )
  const totalMaterialLinks = materials.reduce(
    (sum, material) => sum + material._count.productUsages,
    0,
  )
  const materialStatsByCategory = materials.reduce(
    (acc, material) => {
      const current = acc.get(material.category) ?? {
        positions: 0,
        totalStockQty: 0,
      }
      current.positions += 1
      current.totalStockQty += material.stockQty
      acc.set(material.category, current)
      return acc
    },
    new Map<
      MaterialCategory,
      {
        positions: number
        totalStockQty: number
      }
    >(),
  )
  const parsedRecentDate = parseDateParam(recentAddedDate)
  const parsedRecentFrom = parseDateParam(recentAddedFrom)
  const parsedRecentTo = parseDateParam(recentAddedTo)
  const recentFilterFrom = parsedRecentDate
    ? startOfDay(parsedRecentDate)
    : parsedRecentFrom
      ? startOfDay(parsedRecentFrom)
      : null
  const recentFilterTo = parsedRecentDate
    ? endOfDay(parsedRecentDate)
    : parsedRecentTo
      ? endOfDay(parsedRecentTo)
      : null
  const hasRecentDateFilter = Boolean(recentFilterFrom || recentFilterTo)
  const recentMaterialsPool = [...materials].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  )
  const recentMaterialsFiltered = hasRecentDateFilter
    ? recentMaterialsPool.filter((material) => {
        const createdAt = material.createdAt.getTime()
        if (recentFilterFrom && createdAt < recentFilterFrom.getTime()) {
          return false
        }
        if (recentFilterTo && createdAt > recentFilterTo.getTime()) {
          return false
        }
        return true
      })
    : recentMaterialsPool
  const recentMaterials = hasRecentDateFilter
    ? recentMaterialsFiltered
    : recentMaterialsFiltered.slice(0, 10)
  const recentMaterialsVisible = recentMaterials.slice(0, 5)
  const recentMaterialsHidden = recentMaterials.slice(5)

  function buildMaterialQuickHref(input: {
    name: string
    color: string
    category: MaterialCategory
  }) {
    const q = input.name.trim()
    const queryString = q ? `?q=${encodeURIComponent(q)}` : ''
    return `/admin/inventory/materials/${materialCategoryToSlug(input.category)}${queryString}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{pageTitle}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {view === 'products'
              ? 'Готові залишки, пакування і виробничі матеріали по товарах.'
              : view === 'packaging'
                ? 'Шаблони пакування для автоматичної калькуляції собівартості.'
                : view === 'materials'
                  ? 'Довідник матеріалів, ціна за одиницю і актуальні залишки.'
                  : 'Залишки готових товарів і матеріали, які йдуть на виробництво кожного SKU.'}
          </p>
        </div>

        {showProductsSection ? (
          <form method="get" className="flex flex-col gap-3 sm:flex-row">
            <label className="text-sm font-medium">
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Пошук товару"
                className="mt-2 ml-2 w-full rounded-lg border px-3 py-2 text-sm sm:w-72"
              />
            </label>
            <div className="flex items-end gap-3">
              <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
                Оновити
              </button>
              <Link
                href={basePath}
                className="inline-flex items-center justify-center rounded border px-4 py-2 text-sm"
              >
                Скинути
              </Link>
            </div>
          </form>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded border bg-white p-4">
          <div className="text-sm text-gray-500">Товарів у списку</div>
          <div className="mt-2 text-2xl font-semibold">{products.length}</div>
        </div>
        <div className="rounded border bg-white p-4">
          <div className="text-sm text-gray-500">Готових одиниць на складі</div>
          <div className="mt-2 text-2xl font-semibold">
            {formatQuantity(totalFinishedGoods)}
          </div>
        </div>
        <div className="rounded border bg-white p-4">
          <div className="text-sm text-gray-500">Матеріалів у довіднику</div>
          <div className="mt-2 text-2xl font-semibold">
            {materials.length}{' '}
            <span className="text-base font-normal text-gray-500">позицій</span>
          </div>
        </div>
        <div className="rounded border bg-white p-4">
          <div className="text-sm text-gray-500">
            Прив’язок матеріалів до товарів
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {formatQuantity(totalMaterialLinks)}
          </div>
        </div>
      </section>

      {showMaterialsSection ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Додати нові матеріали</CardTitle>
              <CardDescription>
                Один матеріал може мати кілька кольорових варіантів з різною
                ціною та залишком.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MaterialsBulkCreateForm
                action={createMaterialsBulk}
                categories={MATERIAL_CATEGORIES.map((category) => ({
                  value: category,
                  label: getMaterialCategoryLabel(category),
                  defaultUnit: getMaterialCategoryDefaultUnit(category),
                  slug: materialCategoryToSlug(category),
                }))}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-slate-200">
              <CardTitle>Останні додані матеріали</CardTitle>
              <CardDescription>
                Фільтруй матеріали за конкретною датою або діапазоном дат.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-b border-slate-200 p-4">
                <form
                  method="get"
                  action={basePath}
                  className="grid gap-3 md:grid-cols-[220px_220px_220px_auto_auto]"
                >
                  <label className="text-sm font-medium">
                    Дата
                    <input
                      type="date"
                      name="recentAddedDate"
                      defaultValue={recentAddedDate}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm font-medium">
                    З
                    <input
                      type="date"
                      name="recentAddedFrom"
                      defaultValue={recentAddedFrom}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm font-medium">
                    По
                    <input
                      type="date"
                      name="recentAddedTo"
                      defaultValue={recentAddedTo}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="flex items-end gap-2">
                    <button
                      type="submit"
                      className={cn(
                        buttonVariants({
                          variant: 'default',
                          size: 'sm',
                        }),
                        'h-10',
                      )}
                    >
                      Оновити
                    </button>
                    <Link
                      href={basePath}
                      className={cn(
                        buttonVariants({
                          variant: 'outline',
                          size: 'sm',
                        }),
                        'h-10',
                      )}
                    >
                      Скинути
                    </Link>
                  </div>
                  <div className="flex items-end text-xs text-slate-500">
                    {hasRecentDateFilter
                      ? `Знайдено: ${recentMaterials.length}`
                      : `Показано останніх: ${recentMaterials.length}`}
                  </div>
                </form>
              </div>

              {recentMaterials.length === 0 ? (
                <div className="p-6 text-sm text-gray-600">
                  {hasRecentDateFilter
                    ? 'За обраний період матеріалів не знайдено.'
                    : 'Матеріали ще не додані.'}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Матеріал</TableHead>
                        <TableHead>Категорія</TableHead>
                        <TableHead className="text-right">Додано</TableHead>
                        <TableHead className="text-right">Перехід</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentMaterialsVisible.map((material) => (
                        <TableRow key={material.id}>
                          <TableCell>
                            <div className="font-medium">{material.name}</div>
                            <div className="text-xs text-gray-500">
                              {material.color || 'Без кольору'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getMaterialCategoryLabel(material.category)}
                          </TableCell>
                          <TableCell className="text-right text-xs text-gray-600">
                            {material.createdAt.toLocaleString('uk-UA', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={buildMaterialQuickHref({
                                name: material.name,
                                color: material.color,
                                category: material.category,
                              })}
                              className={cn(
                                buttonVariants({
                                  variant: 'outline',
                                  size: 'sm',
                                }),
                                'h-8',
                              )}
                            >
                              Відкрити
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {recentMaterialsHidden.length > 0 ? (
                    <details className="border-t border-slate-200">
                      <summary className="group flex cursor-pointer list-none items-center p-4 text-sm text-slate-700 hover:bg-slate-50">
                        <span>Показати ще {recentMaterialsHidden.length}</span>
                        <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
                      </summary>
                      <Table>
                        <TableBody>
                          {recentMaterialsHidden.map((material) => (
                            <TableRow key={material.id}>
                              <TableCell>
                                <div className="font-medium">
                                  {material.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {material.color || 'Без кольору'}
                                </div>
                              </TableCell>
                              <TableCell>
                                {getMaterialCategoryLabel(material.category)}
                              </TableCell>
                              <TableCell className="text-right text-xs text-gray-600">
                                {material.createdAt.toLocaleString('uk-UA', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </TableCell>
                              <TableCell className="text-right">
                                <Link
                                  href={buildMaterialQuickHref({
                                    name: material.name,
                                    color: material.color,
                                    category: material.category,
                                  })}
                                  className={cn(
                                    buttonVariants({
                                      variant: 'outline',
                                      size: 'sm',
                                    }),
                                    'h-8',
                                  )}
                                >
                                  Відкрити
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </details>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-slate-200">
              <CardTitle>Категорії матеріалів</CardTitle>
              <CardDescription>
                Вибери категорію, щоб перейти до детального списку матеріалів,
                пошуку і редагування.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              {MATERIAL_CATEGORIES.length === 0 ? (
                <div className="p-6 text-sm text-gray-600">
                  Категорії ще не налаштовані.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Категорія</TableHead>
                      <TableHead>Одиниця за замовчуванням</TableHead>
                      <TableHead className="text-right">Позицій</TableHead>
                      <TableHead className="text-right">Залишок</TableHead>
                      <TableHead className="text-right">Перехід</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MATERIAL_CATEGORIES.map((category) => {
                      const stats = materialStatsByCategory.get(category) ?? {
                        positions: 0,
                        totalStockQty: 0,
                      }
                      const categoryHref = `/admin/inventory/materials/${materialCategoryToSlug(
                        category,
                      )}`
                      return (
                        <TableRow key={category}>
                          <TableCell className="font-medium">
                            {getMaterialCategoryLabel(category)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {getMaterialCategoryDefaultUnit(category)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatQuantity(stats.positions)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatQuantity(stats.totalStockQty)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={categoryHref}
                              className={cn(
                                buttonVariants({
                                  variant: 'outline',
                                  size: 'sm',
                                }),
                                'h-8',
                              )}
                            >
                              Відкрити категорію
                            </Link>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {showPackagingSection ? (
        <section id="packaging-templates" className="rounded border bg-white">
          <details open={packagingOpen || Boolean(editPackagingId)}>
            <summary className="cursor-pointer list-none p-4 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium">Шаблони пакування</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Велика / середня / мала коробка та складові пакування для
                    калькуляції.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                  <span>{packagingTemplates.length} шаблон(ів)</span>
                  <span className="text-sm leading-none">▾</span>
                </div>
              </div>
            </summary>

            <div className="border-t p-4 sm:p-6 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-600">
                  Новий шаблон пакування
                </div>
                <form action={seedDefaultPackagingTemplates}>
                  <button className="inline-flex items-center justify-center rounded border px-4 py-2 text-sm hover:bg-gray-50">
                    Заповнити базові шаблони
                  </button>
                </form>
              </div>

              <form
                action={createPackagingTemplate}
                className="grid gap-3 md:grid-cols-4 xl:grid-cols-6"
              >
                <label className="block text-sm font-medium md:col-span-2 xl:col-span-2">
                  Назва шаблону
                  <input
                    name="name"
                    required
                    className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Пакування: Велика коробка"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Вартість, грн
                  <input
                    name="costUAH"
                    type="number"
                    min="0"
                    defaultValue="0"
                    className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Тип коробки
                  <input
                    name="boxLabel"
                    className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Велика / Середня / Мала"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Тишʼю
                  <input
                    name="tissuePaperQty"
                    type="number"
                    min="0"
                    defaultValue="1"
                    className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Бірки
                  <input
                    name="tagCardQty"
                    type="number"
                    min="0"
                    defaultValue="1"
                    className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Нитки
                  <input
                    name="tagThreadQty"
                    type="number"
                    min="0"
                    defaultValue="1"
                    className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Наліпки круглі
                  <input
                    name="roundStickerQty"
                    type="number"
                    min="0"
                    defaultValue="1"
                    className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Наліпки квадратні
                  <input
                    name="squareStickerQty"
                    type="number"
                    min="0"
                    defaultValue="1"
                    className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium md:col-span-4 xl:col-span-5">
                  Нотатки
                  <input
                    name="notes"
                    className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Опціонально"
                  />
                </label>
                <div className="md:col-span-4 xl:col-span-1 xl:self-end">
                  <button className="inline-flex w-full items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
                    Додати
                  </button>
                </div>
              </form>

              {packagingTemplates.length === 0 ? (
                <div className="rounded border border-dashed p-4 text-sm text-gray-600">
                  Немає жодного шаблону пакування.
                </div>
              ) : (
                <div className="space-y-3">
                  {packagingTemplates.map((template) => {
                    const isEditing = editPackagingId === template.id

                    return (
                      <div key={template.id} className="rounded border p-3">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium">{template.name}</div>
                            <div className="text-sm text-gray-600">
                              {formatUAH(template.costUAH)}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <Link
                              href={`${buildInventoryHref({
                                packagingOpen: true,
                                editPackagingId: template.id,
                              })}#packaging-templates`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Редагувати
                            </Link>
                            <form action={deletePackagingTemplate}>
                              <input
                                type="hidden"
                                name="id"
                                value={template.id}
                              />
                              <ConfirmSubmitButton
                                confirmMessage={`Видалити шаблон "${template.name}"?`}
                                className="text-xs text-red-600 hover:underline"
                              >
                                Видалити
                              </ConfirmSubmitButton>
                            </form>
                          </div>
                        </div>

                        {isEditing ? (
                          <form
                            action={updatePackagingTemplate}
                            className="mt-4 border-t pt-4"
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={template.id}
                            />
                            <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
                              <label className="block text-xs font-medium md:col-span-2">
                                Назва
                                <input
                                  name="name"
                                  defaultValue={template.name}
                                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                                />
                              </label>
                              <label className="block text-xs font-medium">
                                Вартість
                                <input
                                  name="costUAH"
                                  type="number"
                                  min="0"
                                  defaultValue={template.costUAH}
                                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                                />
                              </label>
                              <label className="block text-xs font-medium">
                                Коробка
                                <input
                                  name="boxLabel"
                                  defaultValue={template.boxLabel ?? ''}
                                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                                />
                              </label>
                              <label className="block text-xs font-medium">
                                Тишʼю
                                <input
                                  name="tissuePaperQty"
                                  type="number"
                                  min="0"
                                  defaultValue={template.tissuePaperQty}
                                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                                />
                              </label>
                              <label className="block text-xs font-medium">
                                Бірка / нитка
                                <div className="mt-1 grid grid-cols-2 gap-2">
                                  <input
                                    name="tagCardQty"
                                    type="number"
                                    min="0"
                                    defaultValue={template.tagCardQty}
                                    className="w-full rounded border px-2 py-1.5 text-sm"
                                  />
                                  <input
                                    name="tagThreadQty"
                                    type="number"
                                    min="0"
                                    defaultValue={template.tagThreadQty}
                                    className="w-full rounded border px-2 py-1.5 text-sm"
                                  />
                                </div>
                              </label>
                              <label className="block text-xs font-medium">
                                Наліпки
                                <div className="mt-1 grid grid-cols-2 gap-2">
                                  <input
                                    name="roundStickerQty"
                                    type="number"
                                    min="0"
                                    defaultValue={template.roundStickerQty}
                                    className="w-full rounded border px-2 py-1.5 text-sm"
                                  />
                                  <input
                                    name="squareStickerQty"
                                    type="number"
                                    min="0"
                                    defaultValue={template.squareStickerQty}
                                    className="w-full rounded border px-2 py-1.5 text-sm"
                                  />
                                </div>
                              </label>
                              <label className="block text-xs font-medium md:col-span-4 xl:col-span-6">
                                Нотатки
                                <input
                                  name="notes"
                                  defaultValue={template.notes ?? ''}
                                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                                />
                              </label>
                              <div className="md:col-span-4 xl:col-span-1 xl:self-end flex items-center gap-3">
                                <button className="inline-flex items-center justify-center rounded bg-black px-3 py-2 text-xs text-white hover:bg-[#FF3D8C]">
                                  Зберегти
                                </button>
                                <Link
                                  href={`${buildInventoryHref({
                                    packagingOpen: true,
                                  })}#packaging-templates`}
                                  className="text-xs text-gray-600 hover:underline"
                                >
                                  Скасувати
                                </Link>
                              </div>
                            </div>
                          </form>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </details>
        </section>
      ) : null}

      {showProductsSection ? (
        <section id="products-materials" className="rounded border bg-white">
          <details open>
            <summary className="cursor-pointer list-none p-4 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium">Товари</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Для кожного товару залишили тільки керування запасами по
                    варіантах і шаблоном пакування.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                  <span>{products.length} товар(ів)</span>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </div>
              </div>
            </summary>

            <div className="border-t p-4 sm:p-6 space-y-4">
              {products.length === 0 ? (
                <div className="rounded border bg-white p-4 text-sm text-gray-600">
                  За поточним фільтром товари не знайдені.
                </div>
              ) : (
                products.map((product) => {
                  const previewVariant = product.variants[0]
                  const previewImageUrl =
                    previewVariant?.images[0]?.url ||
                    previewVariant?.image ||
                    '/img/placeholder.png'
                  const productFinishedGoodsQty = product.variants.reduce(
                    (sum, variant) =>
                      sum + (variant.inventory?.finishedGoodsQty ?? 0),
                    0,
                  )
                  const isFocusedProduct = focusedProductId === product.id

                  return (
                    <details
                      key={product.id}
                      id={`product-${product.id}`}
                      className="overflow-hidden rounded border bg-white"
                      open={isFocusedProduct}
                    >
                      <summary className="cursor-pointer list-none p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="h-10 w-10 overflow-hidden rounded-full border bg-gray-100">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={previewImageUrl}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </span>
                              <div>
                                <div className="font-medium">
                                  {product.name}
                                </div>
                                <div className="mt-0.5 text-xs text-gray-500">
                                  {TYPE_LABELS[product.type]}
                                </div>
                              </div>
                            </div>
                            <div className="mt-1 text-sm text-gray-500">
                              Варіантів: {product.variants.length}
                            </div>
                          </div>

                          <div className="inline-flex items-center gap-2 text-sm text-gray-700">
                            <span>
                              Готовий залишок:{' '}
                              <span className="font-medium">
                                {productFinishedGoodsQty}
                              </span>
                            </span>
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          </div>
                        </div>
                      </summary>

                      <div className="border-t p-4 space-y-6">
                        <div className="space-y-3">
                          <div className="font-medium">Запаси по варіантах</div>
                          {product.variants.length === 0 ? (
                            <div className="rounded border border-dashed p-4 text-sm text-gray-600">
                              У товару немає варіантів.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {product.variants.map((variant) => {
                                const variantImageUrl =
                                  variant.images[0]?.url ||
                                  variant.image ||
                                  '/img/placeholder.png'
                                const variantQty =
                                  variant.inventory?.finishedGoodsQty ?? 0
                                const variantNotes =
                                  variant.inventory?.notes ?? ''
                                const variantColor =
                                  variant.color?.trim() || 'Без кольору'

                                return (
                                  <form
                                    key={variant.id}
                                    action={updateVariantInventory}
                                    className="grid gap-3 rounded border p-3 md:grid-cols-[minmax(0,1fr)_180px_auto]"
                                  >
                                    <input
                                      type="hidden"
                                      name="variantId"
                                      value={variant.id}
                                    />
                                    <input
                                      type="hidden"
                                      name="notes"
                                      value={variantNotes}
                                    />
                                    <div className="flex items-center gap-3">
                                      <span className="h-10 w-10 overflow-hidden rounded-full border bg-gray-100">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={variantImageUrl}
                                          alt={`${product.name} ${variantColor}`}
                                          className="h-full w-full object-cover"
                                          loading="lazy"
                                        />
                                      </span>
                                      <div>
                                        <div className="font-medium">
                                          {product.name}
                                        </div>
                                        <span className="mt-1 inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                                          {variantColor}
                                        </span>
                                      </div>
                                    </div>

                                    <label className="block text-sm font-medium">
                                      К-сть на складі
                                      <input
                                        name="finishedGoodsQty"
                                        type="number"
                                        min="0"
                                        defaultValue={variantQty}
                                        className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                                      />
                                    </label>

                                    <div className="md:self-end">
                                      <div className="flex items-center gap-2">
                                        <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
                                          Зберегти
                                        </button>
                                        <Link
                                          href={buildVariantMaterialsHref(
                                            product.id,
                                            variant.id,
                                          )}
                                          className="inline-flex items-center justify-center rounded border px-3 py-2 text-xs hover:bg-gray-50"
                                        >
                                          Матеріали
                                        </Link>
                                      </div>
                                    </div>
                                  </form>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        <form
                          action={assignProductPackagingTemplate}
                          className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]"
                        >
                          <input
                            type="hidden"
                            name="productId"
                            value={product.id}
                          />
                          <label className="block text-sm font-medium">
                            Шаблон пакування
                            <select
                              name="packagingTemplateId"
                              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                              defaultValue={product.packagingTemplateId ?? ''}
                            >
                              <option value="">Без шаблону</option>
                              {packagingTemplates.map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.name} ({formatUAH(template.costUAH)}
                                  )
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="md:self-end">
                            <button className="inline-flex items-center justify-center rounded border px-4 py-2 text-sm hover:bg-gray-50">
                              Зберегти пакування
                            </button>
                          </div>
                        </form>
                      </div>
                    </details>
                  )
                })
              )}
            </div>
          </details>
        </section>
      ) : null}
    </div>
  )
}
