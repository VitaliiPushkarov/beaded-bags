import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { formatUAH } from '@/lib/admin-finance'
import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'
import { TYPE_LABELS } from '@/lib/labels'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    q?: string
  }>
}

const MaterialSchema = z.object({
  name: z.string().trim().min(2),
  unit: z.string().trim().min(1).max(20).default('pcs'),
  stockQty: z.coerce.number().min(0).default(0),
  notes: z.string().trim().optional(),
})

const UpdateMaterialSchema = z.object({
  id: z.string().min(1),
  stockQty: z.coerce.number().min(0).default(0),
  notes: z.string().trim().optional(),
})

const ProductInventorySchema = z.object({
  productId: z.string().min(1),
  finishedGoodsQty: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().optional(),
})

const ProductMaterialSchema = z.object({
  productId: z.string().min(1),
  materialId: z.string().min(1),
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

export default async function AdminInventoryPage({ searchParams }: PageProps) {
  const params = await searchParams
  const query = params.q?.trim() ?? ''

  async function createMaterial(formData: FormData) {
    'use server'

    const parsed = MaterialSchema.safeParse({
      name: formData.get('name'),
      unit: formData.get('unit'),
      stockQty: formData.get('stockQty'),
      notes: formData.get('notes'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося створити матеріал')
    }

    await prisma.material.create({
      data: {
        name: parsed.data.name,
        unit: parsed.data.unit,
        stockQty: parsed.data.stockQty,
        notes: parsed.data.notes || null,
      },
    })

    revalidatePath('/admin/inventory')
  }

  async function updateMaterial(formData: FormData) {
    'use server'

    const parsed = UpdateMaterialSchema.safeParse({
      id: formData.get('id'),
      stockQty: formData.get('stockQty'),
      notes: formData.get('notes'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося оновити матеріал')
    }

    await prisma.material.update({
      where: { id: parsed.data.id },
      data: {
        stockQty: parsed.data.stockQty,
        notes: parsed.data.notes || null,
      },
    })

    revalidatePath('/admin/inventory')
  }

  async function updateProductInventory(formData: FormData) {
    'use server'

    const parsed = ProductInventorySchema.safeParse({
      productId: formData.get('productId'),
      finishedGoodsQty: formData.get('finishedGoodsQty'),
      notes: formData.get('notes'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося оновити запас товару')
    }

    await prisma.productInventory.upsert({
      where: { productId: parsed.data.productId },
      create: {
        productId: parsed.data.productId,
        finishedGoodsQty: parsed.data.finishedGoodsQty,
        notes: parsed.data.notes || null,
      },
      update: {
        finishedGoodsQty: parsed.data.finishedGoodsQty,
        notes: parsed.data.notes || null,
      },
    })

    revalidatePath('/admin/inventory')
  }

  async function upsertProductMaterial(formData: FormData) {
    'use server'

    const parsed = ProductMaterialSchema.safeParse({
      productId: formData.get('productId'),
      materialId: formData.get('materialId'),
      quantity: formData.get('quantity'),
      notes: formData.get('notes'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося зберегти матеріал для товару')
    }

    await prisma.productMaterial.upsert({
      where: {
        productId_materialId: {
          productId: parsed.data.productId,
          materialId: parsed.data.materialId,
        },
      },
      create: {
        productId: parsed.data.productId,
        materialId: parsed.data.materialId,
        quantity: parsed.data.quantity,
        notes: parsed.data.notes || null,
      },
      update: {
        quantity: parsed.data.quantity,
        notes: parsed.data.notes || null,
      },
    })

    revalidatePath('/admin/inventory')
  }

  async function deleteProductMaterial(formData: FormData) {
    'use server'

    const id = String(formData.get('id') || '')
    if (!id) return

    await prisma.productMaterial.delete({
      where: { id },
    })

    revalidatePath('/admin/inventory')
  }

  async function deleteMaterial(formData: FormData) {
    'use server'

    const id = String(formData.get('id') || '')
    if (!id) return

    await prisma.$transaction(async (tx) => {
      await tx.productMaterial.deleteMany({
        where: { materialId: id },
      })

      await tx.material.delete({
        where: { id },
      })
    })

    revalidatePath('/admin/inventory')
  }

  const [materials, products] = await Promise.all([
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
        costProfile: true,
        inventory: true,
        materialUsages: {
          orderBy: {
            material: {
              name: 'asc',
            },
          },
          include: {
            material: true,
          },
        },
      },
    }),
  ])

  const totalFinishedGoods = products.reduce(
    (sum, product) => sum + (product.inventory?.finishedGoodsQty ?? 0),
    0,
  )
  const totalMaterialLinks = materials.reduce(
    (sum, material) => sum + material._count.productUsages,
    0,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Запаси</h1>
          <p className="mt-1 text-sm text-gray-600">
            Залишки готових товарів і матеріали, які йдуть на виробництво кожного SKU.
          </p>
        </div>

        <form method="get" className="flex flex-col gap-3 sm:flex-row">
          <label className="text-sm font-medium">
            Пошук товару
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Назва або slug"
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm sm:w-72"
            />
          </label>
          <div className="flex items-end gap-3">
            <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
              Оновити
            </button>
            <Link
              href="/admin/inventory"
              className="inline-flex items-center justify-center rounded border px-4 py-2 text-sm"
            >
              Скинути
            </Link>
          </div>
        </form>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded border bg-white p-4">
          <div className="text-sm text-gray-500">Товарів у списку</div>
          <div className="mt-2 text-2xl font-semibold">{products.length}</div>
        </div>
        <div className="rounded border bg-white p-4">
          <div className="text-sm text-gray-500">Готових одиниць на складі</div>
          <div className="mt-2 text-2xl font-semibold">{formatQuantity(totalFinishedGoods)}</div>
        </div>
        <div className="rounded border bg-white p-4">
          <div className="text-sm text-gray-500">Матеріалів у довіднику</div>
          <div className="mt-2 text-2xl font-semibold">
            {materials.length} <span className="text-base font-normal text-gray-500">позицій</span>
          </div>
          <div className="mt-1 text-sm text-gray-500">
            Прив'язок до товарів: {totalMaterialLinks}
          </div>
        </div>
      </section>

      <section className="rounded border bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-medium">Новий матеріал</h2>
        <form action={createMaterial} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm font-medium xl:col-span-2">
            Назва
            <input
              name="name"
              required
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Одиниця
            <input
              name="unit"
              defaultValue="гр"
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Залишок
            <input
              name="stockQty"
              type="number"
              min="0"
              step="0.001"
              defaultValue="0"
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium xl:col-span-4">
            Нотатки
            <textarea
              name="notes"
              className="mt-2 min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <div className="xl:col-span-4">
            <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
              Додати матеріал
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded border bg-white">
        <div className="border-b p-4">
          <h2 className="text-lg font-medium">Матеріали</h2>
        </div>

        {materials.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">Ще немає жодного матеріалу.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Матеріал</th>
                  <th className="p-3 text-left">Од.</th>
                  <th className="p-3 text-right">Залишок</th>
                  <th className="p-3 text-right">Товарів використовують</th>
                  <th className="p-3 text-left">Оновити</th>
                  <th className="p-3 text-right">Видалити</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => (
                  <tr key={material.id} className="border-t align-top">
                    <td className="p-3">
                      <div className="font-medium">{material.name}</div>
                      {material.notes ? (
                        <div className="mt-1 text-xs text-gray-500">{material.notes}</div>
                      ) : null}
                    </td>
                    <td className="p-3">{material.unit}</td>
                    <td className="p-3 text-right">{formatQuantity(material.stockQty)}</td>
                    <td className="p-3 text-right">{material._count.productUsages}</td>
                    <td className="p-3">
                      <form action={updateMaterial} className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)_auto]">
                        <input type="hidden" name="id" value={material.id} />
                        <input
                          name="stockQty"
                          type="number"
                          min="0"
                          step="0.001"
                          defaultValue={material.stockQty}
                          className="w-full rounded border px-3 py-2 text-sm"
                        />
                        <input
                          name="notes"
                          defaultValue={material.notes ?? ''}
                          placeholder="Нотатки"
                          className="w-full rounded border px-3 py-2 text-sm"
                        />
                        <button className="inline-flex items-center justify-center rounded bg-black px-3 py-2 text-xs text-white hover:bg-[#FF3D8C]">
                          Зберегти
                        </button>
                      </form>
                    </td>
                    <td className="p-3 text-right">
                      <form action={deleteMaterial}>
                        <input type="hidden" name="id" value={material.id} />
                        <ConfirmSubmitButton
                          confirmMessage={`Видалити матеріал "${material.name}"? Це також прибере його з усіх товарів.`}
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
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Товари і виробничі матеріали</h2>
          <p className="mt-1 text-sm text-gray-600">
            Для кожного товару можна зберегти готовий залишок і перелік матеріалів на 1 одиницю.
          </p>
        </div>

        {products.length === 0 ? (
          <div className="rounded border bg-white p-4 text-sm text-gray-600">
            За поточним фільтром товари не знайдені.
          </div>
        ) : (
          products.map((product) => {
            const finishedGoodsQty = product.inventory?.finishedGoodsQty ?? 0
            const inventoryNotes = product.inventory?.notes ?? ''

            return (
              <details key={product.id} className="overflow-hidden rounded border bg-white" open={product.materialUsages.length > 0}>
                <summary className="cursor-pointer list-none p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="mt-1 text-sm text-gray-500">
                        {product.slug} • {TYPE_LABELS[product.type]}
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        Матеріалів: {product.materialUsages.length}
                        <span className="mx-2 text-gray-300">•</span>
                        Матеріальна частина собівартості: {formatUAH(product.costProfile?.materialsCostUAH ?? 0)}
                      </div>
                    </div>

                    <div className="text-sm text-gray-700">
                      Готовий залишок: <span className="font-medium">{finishedGoodsQty}</span>
                    </div>
                  </div>
                </summary>

                <div className="border-t p-4 space-y-6">
                  <form action={updateProductInventory} className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)_auto]">
                    <input type="hidden" name="productId" value={product.id} />
                    <label className="block text-sm font-medium">
                      Готових одиниць
                      <input
                        name="finishedGoodsQty"
                        type="number"
                        min="0"
                        defaultValue={finishedGoodsQty}
                        className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Нотатки по запасу
                      <input
                        name="notes"
                        defaultValue={inventoryNotes}
                        placeholder="Наприклад: резерв під шоурум"
                        className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="md:self-end">
                      <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
                        Зберегти запас
                      </button>
                    </div>
                  </form>

                  <div className="space-y-4">
                    <div className="font-medium">Матеріали на 1 одиницю товару</div>

                    {product.materialUsages.length === 0 ? (
                      <div className="rounded border border-dashed p-4 text-sm text-gray-600">
                        Ще не додано жодного матеріалу для цього товару.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="p-3 text-left">Матеріал</th>
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
                                    Залишок матеріалу: {formatQuantity(usage.material.stockQty)} {usage.material.unit}
                                  </div>
                                </td>
                                <td className="p-3 text-right">
                                  {formatQuantity(usage.quantity)} {usage.material.unit}
                                </td>
                                <td className="p-3">{usage.notes || '—'}</td>
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

                    {materials.length === 0 ? (
                      <div className="text-sm text-gray-600">
                        Спочатку додайте матеріали у верхньому блоці.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500">
                          Якщо матеріал уже доданий до товару, повторне збереження оновить його кількість.
                        </div>
                        <form action={upsertProductMaterial} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)_auto]">
                        <input type="hidden" name="productId" value={product.id} />
                        <label className="block text-sm font-medium">
                          Матеріал
                          <select
                            name="materialId"
                            required
                            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Оберіть матеріал
                            </option>
                            {materials.map((material) => (
                              <option key={material.id} value={material.id}>
                                {material.name} ({material.unit})
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block text-sm font-medium">
                          К-сть на 1 шт.
                          <input
                            name="quantity"
                            type="number"
                            min="0.001"
                            step="0.001"
                            required
                            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                          />
                        </label>

                        <label className="block text-sm font-medium">
                          Нотатки
                          <input
                            name="notes"
                            placeholder="Наприклад: основний колір"
                            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                          />
                        </label>

                        <div className="md:self-end">
                          <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
                            Додати матеріал
                          </button>
                        </div>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            )
          })
        )}
      </section>
    </div>
  )
}
