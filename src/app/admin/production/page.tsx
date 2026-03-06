import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { formatDate, formatUAH, toDateInputValue } from '@/lib/admin-finance'
import {
  buildManagedUnitCostUAH,
  calculateMaterialsCostFromUsages,
} from '@/lib/management-accounting'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    q?: string
    from?: string
    to?: string
  }>
}

const ProductionBatchSchema = z.object({
  productId: z.string().min(1),
  qty: z.coerce.number().int().min(1),
  producedAt: z.coerce.date(),
  laborTotalUAH: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().optional(),
})

function parseOptionalDate(value?: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (Number.isInteger(value)) return String(value)
  return value.toLocaleString('uk-UA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}

export default async function AdminProductionPage({ searchParams }: PageProps) {
  const params = await searchParams
  const query = params.q?.trim() ?? ''
  const from = parseOptionalDate(params.from)
  const to = parseOptionalDate(params.to)

  async function createProductionBatch(formData: FormData) {
    'use server'

    const parsed = ProductionBatchSchema.safeParse({
      productId: formData.get('productId'),
      qty: formData.get('qty'),
      producedAt: formData.get('producedAt'),
      laborTotalUAH: formData.get('laborTotalUAH'),
      notes: formData.get('notes'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося провести виробництво')
    }

    const qty = parsed.data.qty
    const product = await prisma.product.findUnique({
      where: { id: parsed.data.productId },
      include: {
        packagingTemplate: true,
        costProfile: true,
        materialUsages: {
          include: {
            material: true,
          },
        },
      },
    })

    if (!product) {
      throw new Error('Товар не знайдено')
    }

    const usageLines = product.materialUsages.map((usage) => ({
      usageId: usage.id,
      materialId: usage.materialId,
      materialName: usage.material.name,
      materialUnit: usage.material.unit,
      unitCostUAH: usage.material.unitCostUAH,
      qtyPerUnit: usage.quantity,
      qtyUsed: usage.quantity * qty,
      stockQty: usage.material.stockQty,
    }))

    const insufficient = usageLines.filter((line) => line.stockQty < line.qtyUsed)
    if (insufficient.length > 0) {
      const names = insufficient.map((line) => line.materialName).join(', ')
      throw new Error(`Недостатньо залишку матеріалів: ${names}`)
    }

    const materialsTotalUAH = Math.round(
      usageLines.reduce((sum, line) => sum + line.qtyUsed * line.unitCostUAH, 0),
    )
    const packagingPerUnitUAH = product.packagingTemplate?.costUAH ?? product.costProfile?.packagingCostUAH ?? 0
    const packagingTotalUAH = packagingPerUnitUAH * qty
    const laborPerUnitUAH = qty > 0 ? Math.round(parsed.data.laborTotalUAH / qty) : 0
    const materialsPerUnitUAH = calculateMaterialsCostFromUsages(
      product.materialUsages.map((usage) => ({
        quantity: usage.quantity,
        material: { unitCostUAH: usage.material.unitCostUAH },
      })),
    )

    await prisma.$transaction(async (tx) => {
      const batch = await tx.productionBatch.create({
        data: {
          productId: product.id,
          producedAt: parsed.data.producedAt,
          qty,
          laborTotalUAH: parsed.data.laborTotalUAH,
          laborPerUnitUAH,
          materialsTotalUAH,
          packagingTotalUAH,
          notes: parsed.data.notes || null,
          materials: {
            create: usageLines.map((line) => ({
              materialId: line.materialId,
              qtyUsed: line.qtyUsed,
              unitCostUAH: line.unitCostUAH,
              totalCostUAH: Math.round(line.qtyUsed * line.unitCostUAH),
            })),
          },
        },
      })

      for (const line of usageLines) {
        await tx.material.update({
          where: { id: line.materialId },
          data: {
            stockQty: {
              decrement: line.qtyUsed,
            },
          },
        })
      }

      await tx.productInventory.upsert({
        where: { productId: product.id },
        create: {
          productId: product.id,
          finishedGoodsQty: qty,
          notes: `Оновлено через production batch ${batch.id}`,
        },
        update: {
          finishedGoodsQty: {
            increment: qty,
          },
        },
      })

      await tx.productCostProfile.upsert({
        where: { productId: product.id },
        create: {
          productId: product.id,
          materialsCostUAH: materialsPerUnitUAH,
          laborCostUAH: laborPerUnitUAH,
          packagingCostUAH: packagingPerUnitUAH,
          shippingCostUAH: 0,
        },
        update: {
          materialsCostUAH: materialsPerUnitUAH,
          laborCostUAH: laborPerUnitUAH,
          packagingCostUAH: packagingPerUnitUAH,
          shippingCostUAH: 0,
        },
      })

      if (parsed.data.laborTotalUAH > 0) {
        await tx.expense.create({
          data: {
            title: `Оплата роботи: ${product.name}`,
            category: 'PAYROLL',
            amountUAH: parsed.data.laborTotalUAH,
            expenseDate: parsed.data.producedAt,
            notes: `productionBatch:${batch.id}`,
          },
        })
      }
    })

    revalidatePath('/admin/production')
    revalidatePath('/admin/inventory')
    revalidatePath('/admin/costs')
    revalidatePath('/admin/finance')
    revalidatePath('/admin')
  }

  const [products, batches] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { slug: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ sortCatalog: 'asc' }, { name: 'asc' }],
      include: {
        costProfile: true,
        packagingTemplate: true,
        materialUsages: {
          include: {
            material: true,
          },
        },
      },
    }),
    prisma.productionBatch.findMany({
      where: {
        ...(query
          ? {
              OR: [
                { product: { name: { contains: query, mode: 'insensitive' } } },
                { product: { slug: { contains: query, mode: 'insensitive' } } },
                { notes: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(from || to
          ? {
              producedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ producedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        materials: {
          include: {
            material: {
              select: {
                name: true,
                unit: true,
              },
            },
          },
        },
      },
      take: 200,
    }),
  ])

  const totalProducedQty = batches.reduce((sum, batch) => sum + batch.qty, 0)
  const totalLaborUAH = batches.reduce((sum, batch) => sum + batch.laborTotalUAH, 0)
  const totalMaterialUAH = batches.reduce((sum, batch) => sum + batch.materialsTotalUAH, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Виробництво</h1>
        <p className="mt-1 text-sm text-gray-600">
          Проведення батчів: списання матеріалів, прихід готових товарів і фіксація оплати роботи.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded border bg-white p-4">
          <div className="text-sm text-gray-500">Одиниць виготовлено</div>
          <div className="mt-2 text-2xl font-semibold">{totalProducedQty}</div>
        </div>
        <div className="rounded border bg-white p-4">
          <div className="text-sm text-gray-500">Матеріали списано</div>
          <div className="mt-2 text-2xl font-semibold">{formatUAH(totalMaterialUAH)}</div>
        </div>
        <div className="rounded border bg-white p-4">
          <div className="text-sm text-gray-500">Оплата роботи</div>
          <div className="mt-2 text-2xl font-semibold">{formatUAH(totalLaborUAH)}</div>
        </div>
      </section>

      <section className="rounded border bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-medium">Новий production batch</h2>
        <form action={createProductionBatch} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm font-medium sm:col-span-2">
            Товар
            <select
              name="productId"
              required
              defaultValue=""
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Оберіть товар
              </option>
              {products.map((product) => {
                const unitCost = buildManagedUnitCostUAH({
                  profile: product.costProfile,
                  materialUsages: product.materialUsages.map((usage) => ({
                    quantity: usage.quantity,
                    material: { unitCostUAH: usage.material.unitCostUAH },
                  })),
                  packagingTemplateCostUAH: product.packagingTemplate?.costUAH,
                  includeShipping: false,
                })
                return (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.slug}) • unit {formatUAH(unitCost)}
                  </option>
                )
              })}
            </select>
          </label>

          <label className="block text-sm font-medium">
            К-сть виготовлено
            <input
              name="qty"
              type="number"
              min="1"
              defaultValue="1"
              required
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Дата
            <input
              name="producedAt"
              type="date"
              defaultValue={toDateInputValue(new Date())}
              required
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Оплата роботи, грн
            <input
              name="laborTotalUAH"
              type="number"
              min="0"
              defaultValue="0"
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium sm:col-span-2 xl:col-span-4">
            Нотатки
            <textarea
              name="notes"
              className="mt-2 min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Опціонально"
            />
          </label>

          <div className="xl:col-span-4">
            <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
              Провести batch
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded border bg-white">
        <div className="space-y-3 border-b p-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium">Історія production batches</h2>
            <Link href="/admin/inventory" className="text-sm text-blue-600 hover:underline">
              До запасів
            </Link>
          </div>
          <form method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm font-medium xl:col-span-2">
              Пошук
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Назва товару, slug або нотатка"
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium">
              Від
              <input
                type="date"
                name="from"
                defaultValue={from ? toDateInputValue(from) : ''}
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium">
              До
              <input
                type="date"
                name="to"
                defaultValue={to ? toDateInputValue(to) : ''}
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <div className="flex items-end gap-3 xl:col-span-1">
              <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
                Застосувати
              </button>
              <Link
                href="/admin/production"
                className="inline-flex items-center justify-center rounded border px-4 py-2 text-sm"
              >
                Скинути
              </Link>
            </div>
          </form>
        </div>

        {batches.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">Ще немає жодного batch.</div>
        ) : (
          <div className="divide-y">
            {batches.map((batch) => (
              <div key={batch.id} className="p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-medium">
                      {batch.product.name} <span className="text-sm text-gray-500">({batch.product.slug})</span>
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      {formatDate(batch.producedAt)} • Batch: {batch.id}
                    </div>
                    {batch.notes ? (
                      <div className="mt-1 text-sm text-gray-600">{batch.notes}</div>
                    ) : null}
                  </div>
                  <div className="text-right text-sm">
                    <div>
                      К-сть: <span className="font-medium">{batch.qty}</span>
                    </div>
                    <div className="text-gray-600">Матеріали: {formatUAH(batch.materialsTotalUAH)}</div>
                    <div className="text-gray-600">Пакування: {formatUAH(batch.packagingTotalUAH)}</div>
                    <div className="text-gray-600">Робота: {formatUAH(batch.laborTotalUAH)}</div>
                  </div>
                </div>

                {batch.materials.length > 0 ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 text-left">Матеріал</th>
                          <th className="p-2 text-right">Списано</th>
                          <th className="p-2 text-right">Ціна</th>
                          <th className="p-2 text-right">Сума</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batch.materials.map((line) => (
                          <tr key={line.id} className="border-t">
                            <td className="p-2">{line.material.name}</td>
                            <td className="p-2 text-right">
                              {formatQuantity(line.qtyUsed)} {line.material.unit}
                            </td>
                            <td className="p-2 text-right">{formatUAH(line.unitCostUAH)}</td>
                            <td className="p-2 text-right">{formatUAH(line.totalCostUAH)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-gray-600">
                    Матеріали не були прив'язані до товару на момент проведення batch.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
