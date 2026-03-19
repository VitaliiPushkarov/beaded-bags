import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { ChevronDown, ChevronUp } from 'lucide-react'

import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'
import { formatUAH } from '@/lib/admin-finance'
import { TYPE_LABELS } from '@/lib/labels'
import { getMaterialCategoryLabel } from '@/lib/material-categories'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    productId: string
    variantId: string
  }>
  searchParams: Promise<{
    materialQ?: string
    materialPage?: string
  }>
}

const VariantInventorySchema = z.object({
  variantId: z.string().min(1),
  finishedGoodsQty: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().optional(),
})

const ProductMaterialSchema = z.object({
  productId: z.string().min(1),
  materialId: z.string().min(1),
  variantColor: z.string().trim().optional(),
  quantity: z.coerce.number().positive(),
  notes: z.string().trim().optional(),
})

function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (Number.isInteger(value)) return String(value)
  return value.toLocaleString('uk-UA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

function formatMaterialUnitPrice(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0
  const shouldShowDecimals = safeValue > 0 && safeValue < 1

  return `${safeValue.toLocaleString('uk-UA', {
    minimumFractionDigits: shouldShowDecimals ? 3 : 0,
    maximumFractionDigits: 3,
  })} ₴`
}

export default async function AdminInventoryVariantMaterialsPage({
  params,
  searchParams,
}: PageProps) {
  const { productId, variantId } = await params
  const sp = await searchParams
  const materialQ = sp.materialQ?.trim() ?? ''
  const materialPageRaw = Number.parseInt(sp.materialPage ?? '1', 10)
  const materialPage = Number.isFinite(materialPageRaw)
    ? Math.max(1, materialPageRaw)
    : 1
  const MATERIALS_PAGE_SIZE = 10
  const materialsTake = materialPage * MATERIALS_PAGE_SIZE

  const pagePath = `/admin/inventory/products/${productId}/variants/${variantId}`
  const backHref = '/admin/inventory/products'
  const searchHref = materialQ
    ? `${pagePath}?materialQ=${encodeURIComponent(materialQ)}`
    : pagePath

  function buildMaterialChooserHref(input?: {
    materialQ?: string
    materialPage?: number
  }) {
    const qs = new URLSearchParams()
    const nextQ = input?.materialQ ?? materialQ
    const nextPage = input?.materialPage ?? materialPage

    if (nextQ) qs.set('materialQ', nextQ)
    if (nextPage > 1) qs.set('materialPage', String(nextPage))

    const query = qs.toString()
    return query ? `${pagePath}?${query}` : pagePath
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

    revalidatePath('/admin/inventory')
    revalidatePath('/admin/inventory/products')
    revalidatePath(pagePath)
  }

  async function upsertProductMaterial(formData: FormData) {
    'use server'

    const parsed = ProductMaterialSchema.safeParse({
      productId: formData.get('productId'),
      materialId: formData.get('materialId'),
      variantColor: formData.get('variantColor'),
      quantity: formData.get('quantity'),
      notes: formData.get('notes'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося зберегти матеріал для товару')
    }

    await prisma.productMaterial.upsert({
      where: {
        productId_materialId_variantColor: {
          productId: parsed.data.productId,
          materialId: parsed.data.materialId,
          variantColor: parsed.data.variantColor?.trim() || '',
        },
      },
      create: {
        productId: parsed.data.productId,
        materialId: parsed.data.materialId,
        variantColor: parsed.data.variantColor?.trim() || '',
        quantity: parsed.data.quantity,
        notes: parsed.data.notes || null,
      },
      update: {
        variantColor: parsed.data.variantColor?.trim() || '',
        quantity: parsed.data.quantity,
        notes: parsed.data.notes || null,
      },
    })

    revalidatePath('/admin/inventory')
    revalidatePath('/admin/inventory/products')
    revalidatePath(pagePath)
    revalidatePath('/admin/costs')
    revalidatePath('/admin/finance')
  }

  async function deleteProductMaterial(formData: FormData) {
    'use server'

    const id = String(formData.get('id') || '')
    if (!id) return

    await prisma.productMaterial.delete({
      where: { id },
    })

    revalidatePath('/admin/inventory')
    revalidatePath('/admin/inventory/products')
    revalidatePath(pagePath)
    revalidatePath('/admin/costs')
    revalidatePath('/admin/finance')
  }

  const [product, materials, materialsTotal] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
        include: {
          variants: {
            orderBy: [{ sortCatalog: 'asc' }, { id: 'asc' }],
            include: {
              inventory: true,
              images: {
                orderBy: { sort: 'asc' },
                take: 1,
              },
            },
          },
          materialUsages: {
            orderBy: [
              {
                material: {
                  name: 'asc',
                },
              },
              {
                variantColor: 'asc',
              },
            ],
            include: {
              material: true,
            },
          },
        },
      }),
      prisma.material.findMany({
        where: materialQ
          ? {
              OR: [
                {
                  name: {
                    contains: materialQ,
                    mode: 'insensitive',
                  },
                },
                {
                  color: {
                    contains: materialQ,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : undefined,
        orderBy: [{ name: 'asc' }, { color: 'asc' }],
        take: materialsTake,
      }),
      prisma.material.count({
        where: materialQ
          ? {
              OR: [
                {
                  name: {
                    contains: materialQ,
                    mode: 'insensitive',
                  },
                },
                {
                  color: {
                    contains: materialQ,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : undefined,
      }),
    ])

  if (!product) {
    return notFound()
  }

  const variant = product.variants.find((item) => item.id === variantId)
  if (!variant) {
    return notFound()
  }

  const variantColorRaw = variant.color?.trim() || ''
  const variantColor = variantColorRaw || 'Без кольору'
  const variantImageUrl =
    variant.images[0]?.url || variant.image || '/img/placeholder.png'
  const variantQty = variant.inventory?.finishedGoodsQty ?? 0
  const variantNotes = variant.inventory?.notes ?? ''
  const usageByScopedKey = new Map(
    product.materialUsages.map((usage) => [
      `${usage.materialId}::${usage.variantColor}`,
      usage,
    ]),
  )
  const productVariantColors = Array.from(
    new Set(
      product.variants
        .map((item) => item.color?.trim() || '')
        .filter((value): value is string => Boolean(value)),
    ),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={backHref}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Назад до товарів у запасах
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Матеріали варіанту</h1>
          <p className="mt-1 text-sm text-gray-600">
            Для кожного матеріалу можна вказати, до якого кольору варіанту він
            застосовується.
          </p>
        </div>
      </div>

      <section className="rounded border bg-white p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="h-12 w-12 overflow-hidden rounded-full border bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={variantImageUrl}
              alt={`${product.name} ${variantColor}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </span>
          <div>
            <div className="font-medium">{product.name}</div>
            <div className="mt-0.5 text-xs text-gray-500">
              {TYPE_LABELS[product.type]}
            </div>
            <div className="mt-1 inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
              {variantColor}
            </div>
          </div>
        </div>

        <form
          action={updateVariantInventory}
          className="mt-4 grid gap-3 rounded border p-3 md:grid-cols-[220px_auto]"
        >
          <input type="hidden" name="variantId" value={variant.id} />
          <input type="hidden" name="notes" value={variantNotes} />
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
            <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
              Зберегти запас варіанту
            </button>
          </div>
        </form>
      </section>

      <section className="rounded border bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-medium">
              Матеріали на 1 одиницю товару
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Уникаємо довгого скролу: спочатку введіть пошук, потім додайте
              матеріал.
            </p>
          </div>
          <div className="text-sm text-gray-500">
            Додано:{' '}
            <span className="font-medium text-gray-900">
              {product.materialUsages.length}
            </span>
          </div>
        </div>

        {product.materialUsages.length === 0 ? (
          <div className="mt-4 rounded border border-dashed p-4 text-sm text-gray-600">
            Ще не додано жодного матеріалу.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Матеріал</th>
                  <th className="p-3 text-left">Застосовується до</th>
                  <th className="p-3 text-right">Кількість</th>
                  <th className="p-3 text-left">Нотатки</th>
                  <th className="p-3 text-right">Дії</th>
                </tr>
              </thead>
              <tbody>
                {product.materialUsages.map((usage) => (
                  <tr key={usage.id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{usage.material.name}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {getMaterialCategoryLabel(usage.material.category)}
                        {usage.material.color ? ` · ${usage.material.color}` : ''}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Залишок: {formatQuantity(usage.material.stockQty)}{' '}
                        {usage.material.unit}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Ціна за 1 од.:{' '}
                        {formatMaterialUnitPrice(usage.material.unitCostUAH)}
                      </div>
                    </td>
                    <td className="p-3">
                      {usage.variantColor?.trim() ? (
                        <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                          {usage.variantColor.trim()}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">Усі варіанти</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {formatQuantity(usage.quantity)} {usage.material.unit}
                    </td>
                    <td className="p-3">
                      {usage.notes || '—'}
                      <div className="mt-1 text-xs text-gray-500">
                        Вартість на 1 товар:{' '}
                        {formatUAH(
                          Math.round(
                            usage.quantity * usage.material.unitCostUAH,
                          ),
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <form action={deleteProductMaterial}>
                        <input type="hidden" name="id" value={usage.id} />
                        <ConfirmSubmitButton
                          confirmMessage={`Прибрати матеріал "${usage.material.name}" з цього товару?`}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Видалити
                        </ConfirmSubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-5 space-y-3 rounded border bg-slate-50 p-4">
          <form
            method="get"
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]"
          >
            <label className="block text-sm font-medium">
              Пошук матеріалу
              <input
                type="search"
                name="materialQ"
                defaultValue={materialQ}
                placeholder="Введіть назву матеріалу"
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <div className="md:self-end">
              <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
                Оновити список
              </button>
            </div>
            <div className="md:self-end">
              <Link
                href={pagePath}
                className="inline-flex items-center justify-center rounded border px-4 py-2 text-sm hover:bg-gray-50"
              >
                Скинути
              </Link>
            </div>
          </form>

          <div className="text-xs text-gray-500">
            Знайдено матеріалів: {materialsTotal}. Показано:{' '}
            {Math.min(materials.length, materialsTotal)}.
          </div>

          {materials.length === 0 ? (
            <div className="text-sm text-gray-600">
              За цим фільтром матеріали не знайдені.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded border bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left">Матеріал</th>
                      <th className="p-3 text-left">Категорія / колір</th>
                      <th className="p-3 text-left">Од.</th>
                      <th className="p-3 text-right">Залишок</th>
                      <th className="p-3 text-right">Ціна за 1 од.</th>
                      <th className="p-3 text-left">Для варіанту</th>
                      <th className="p-3 text-right">К-сть на 1 шт.</th>
                      <th className="p-3 text-right">Дія</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((material) => {
                      const usageForCurrentVariant = usageByScopedKey.get(
                        `${material.id}::${variantColorRaw}`,
                      )
                      const usageForAllVariants = usageByScopedKey.get(
                        `${material.id}::`,
                      )
                      const usage = usageForCurrentVariant ?? usageForAllVariants
                      const defaultVariantScope = usageForCurrentVariant
                        ? variantColorRaw
                        : usageForAllVariants
                          ? ''
                          : variantColorRaw
                      const formId = `add-material-${material.id}`
                      return (
                        <tr key={material.id} className="border-t">
                          <td className="p-3">
                            <div className="font-medium">{material.name}</div>
                          </td>
                          <td className="p-3">
                            <div>{getMaterialCategoryLabel(material.category)}</div>
                            <div className="mt-1 text-xs text-gray-500">
                              {material.color || 'Без кольору'}
                            </div>
                          </td>
                          <td className="p-3">{material.unit}</td>
                          <td className="p-3 text-right">
                            {formatQuantity(material.stockQty)}
                          </td>
                          <td className="p-3 text-right">
                            {formatMaterialUnitPrice(material.unitCostUAH)}
                          </td>
                          <td className="p-3">
                            <select
                              form={formId}
                              name="variantColor"
                              defaultValue={defaultVariantScope}
                              className="w-44 rounded border px-2 py-1.5 text-xs"
                            >
                              <option value="">Усі варіанти</option>
                              {productVariantColors.map((color) => (
                                <option key={color} value={color}>
                                  {color}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 text-right">
                            <form
                              id={formId}
                              action={upsertProductMaterial}
                              className="inline-flex items-center justify-end gap-2"
                            >
                              <input
                                type="hidden"
                                name="productId"
                                value={product.id}
                              />
                              <input
                                type="hidden"
                                name="materialId"
                                value={material.id}
                              />
                              <input
                                name="quantity"
                                type="number"
                                min="0.001"
                                step="0.001"
                                defaultValue={usage?.quantity ?? ''}
                                required
                                className="w-28 rounded border px-2 py-1.5 text-right text-xs"
                              />
                              <input
                                type="hidden"
                                name="notes"
                                value={usage?.notes ?? ''}
                              />
                            </form>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              form={formId}
                              className="inline-flex items-center justify-center rounded border px-3 py-1.5 text-xs hover:bg-gray-50"
                            >
                              {usage ? 'Оновити' : 'Додати'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {materialsTotal > materials.length ? (
                  <Link
                    href={buildMaterialChooserHref({
                      materialPage: materialPage + 1,
                    })}
                    className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 hover:underline"
                  >
                    <span>Показати ще {MATERIALS_PAGE_SIZE}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Link>
                ) : null}

                {materialPage > 1 ? (
                  <Link
                    href={buildMaterialChooserHref({
                      materialPage: 1,
                    })}
                    className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 hover:underline"
                  >
                    <span>Згорнути до {MATERIALS_PAGE_SIZE}</span>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>

      <div className="text-xs text-gray-500">
        <Link href={searchHref} className="hover:underline">
          Постійне посилання на цю сторінку
        </Link>
      </div>
    </div>
  )
}
