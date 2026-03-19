import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { MaterialCategory, Prisma } from '@prisma/client'
import { z } from 'zod'

import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  getMaterialCategoryDefaultUnit,
  getMaterialCategoryLabel,
  materialCategoryFromSlug,
  materialCategoryToSlug,
  MATERIAL_CATEGORIES,
} from '@/lib/material-categories'
import { formatUAH } from '@/lib/admin-finance'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    category: string
  }>
  searchParams: Promise<{
    q?: string
    scope?: string
  }>
}

type ScopeFilter =
  | 'all'
  | 'with-color'
  | 'without-color'
  | 'in-stock'
  | 'out-of-stock'

const UpdateMaterialSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2),
  category: z.nativeEnum(MaterialCategory),
  color: z.string().trim().max(80).default(''),
  unit: z.string().trim().min(1).max(20),
  stockQty: z.coerce.number().min(0).default(0),
  unitCostUAH: z.coerce.number().min(0).default(0),
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

function getScopeFilter(value: string | undefined): ScopeFilter {
  switch (value) {
    case 'with-color':
      return 'with-color'
    case 'without-color':
      return 'without-color'
    case 'in-stock':
      return 'in-stock'
    case 'out-of-stock':
      return 'out-of-stock'
    default:
      return 'all'
  }
}

export default async function AdminInventoryMaterialsCategoryPage({
  params,
  searchParams,
}: PageProps) {
  const { category: categorySlug } = await params
  const category = materialCategoryFromSlug(categorySlug)

  if (!category) {
    return notFound()
  }

  const sp = await searchParams
  const query = sp.q?.trim() ?? ''
  const scope = getScopeFilter(sp.scope)
  const pagePath = `/admin/inventory/materials/${categorySlug}`

  function buildPageHref(input?: { q?: string; scope?: ScopeFilter }) {
    const nextQ = input?.q ?? query
    const nextScope = input?.scope ?? scope
    const qs = new URLSearchParams()

    if (nextQ) qs.set('q', nextQ)
    if (nextScope !== 'all') qs.set('scope', nextScope)

    const queryString = qs.toString()
    return queryString ? `${pagePath}?${queryString}` : pagePath
  }

  async function updateMaterial(formData: FormData) {
    'use server'

    const parsed = UpdateMaterialSchema.safeParse({
      id: formData.get('id'),
      name: formData.get('name'),
      category: formData.get('category'),
      color: formData.get('color'),
      unit: formData.get('unit'),
      stockQty: formData.get('stockQty'),
      unitCostUAH: formData.get('unitCostUAH'),
      notes: formData.get('notes'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося оновити матеріал')
    }

    await prisma.material.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        category: parsed.data.category,
        color: parsed.data.color,
        unit: parsed.data.unit,
        stockQty: parsed.data.stockQty,
        unitCostUAH: parsed.data.unitCostUAH,
        notes: parsed.data.notes || null,
      },
    })

    revalidatePath('/admin/inventory/materials')
    revalidatePath('/admin/costs')
    revalidatePath('/admin/finance')
    for (const item of MATERIAL_CATEGORIES) {
      revalidatePath(
        `/admin/inventory/materials/${materialCategoryToSlug(item)}`,
      )
    }
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

    revalidatePath('/admin/inventory/materials')
    revalidatePath('/admin/costs')
    revalidatePath('/admin/finance')
    for (const item of MATERIAL_CATEGORIES) {
      revalidatePath(
        `/admin/inventory/materials/${materialCategoryToSlug(item)}`,
      )
    }
  }

  const where: Prisma.MaterialWhereInput = {
    category,
    ...(query
      ? {
          OR: [
            {
              name: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              color: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              notes: {
                contains: query,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {}),
    ...(scope === 'with-color'
      ? {
          NOT: {
            color: '',
          },
        }
      : scope === 'without-color'
        ? {
            color: '',
          }
        : scope === 'in-stock'
          ? {
              stockQty: {
                gt: 0,
              },
            }
          : scope === 'out-of-stock'
            ? {
                stockQty: {
                  lte: 0,
                },
              }
            : {}),
  }

  const materials = await prisma.material.findMany({
    where,
    orderBy: [{ name: 'asc' }, { color: 'asc' }],
    include: {
      _count: {
        select: {
          productUsages: true,
        },
      },
    },
  })

  const categoryLabel = getMaterialCategoryLabel(category)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/admin/inventory/materials"
            className={cn(
              buttonVariants({
                variant: 'ghost',
                size: 'sm',
              }),
              'px-0',
            )}
          >
            ← Назад до категорій матеріалів
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{categoryLabel}</h1>
          <p className="mt-1 text-sm text-gray-600">
            Швидкий пошук, фільтрація і редагування матеріалів категорії.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Фільтри і пошук</CardTitle>
          {/*  <CardDescription>
            Швидко знаходь матеріали за назвою, кольором або нотаткою.
          </CardDescription> */}
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            method="get"
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px_auto]"
          >
            <div className="space-y-1.5">
              <Label htmlFor="material-search">Пошук матеріалу</Label>
              <Input
                id="material-search"
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Назва / колір / нотатка"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="material-scope">Швидкий фільтр</Label>
              <Select id="material-scope" name="scope" defaultValue={scope}>
                <option value="all">Усі</option>
                <option value="with-color">Тільки з кольором</option>
                <option value="without-color">Без кольору</option>
                <option value="in-stock">Тільки в наявності</option>
                <option value="out-of-stock">Немає в наявності</option>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit">Оновити</Button>
              <Link
                href={pagePath}
                className={buttonVariants({ variant: 'outline' })}
              >
                Скинути
              </Link>
            </div>
          </form>

          <div className="flex flex-wrap gap-2 text-xs">
            {(
              [
                { key: 'all', label: 'Усі' },
                { key: 'with-color', label: 'З кольором' },
                { key: 'without-color', label: 'Без кольору' },
                { key: 'in-stock', label: 'В наявності' },
                { key: 'out-of-stock', label: 'Немає в наявності' },
              ] as Array<{ key: ScopeFilter; label: string }>
            ).map((filter) => (
              <Link
                key={filter.key}
                href={buildPageHref({ scope: filter.key })}
                className={cn(
                  buttonVariants({
                    variant: scope === filter.key ? 'default' : 'outline',
                    size: 'sm',
                  }),
                  'h-8 rounded-full px-4',
                )}
              >
                {filter.label}
              </Link>
            ))}
          </div>

          {/*  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>Знайдено матеріалів: {materials.length}.</span>
            <Badge variant="secondary">
              Дефолтна одиниця: {getMaterialCategoryDefaultUnit(category)}
            </Badge>
          </div> */}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-200">
          <CardTitle>Матеріали категорії</CardTitle>
          <CardDescription>
            Ручне редагування: один рядок — один матеріал.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {materials.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">
              За поточним фільтром матеріали не знайдені.
            </div>
          ) : (
            <Table className="table-fixed [&_th]:px-2 [&_th]:py-2 [&_td]:px-2 [&_td]:py-2">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[20%]">Назва</TableHead>
                  <TableHead className="w-[10%]">Категорія</TableHead>
                  <TableHead className="w-[10%]">Колір</TableHead>
                  <TableHead className="w-14">Од.</TableHead>
                  <TableHead className="w-[4.5rem] text-right">
                    Залишок
                  </TableHead>
                  <TableHead className="w-[5.5rem] text-right">
                    Ціна за 1 од.
                  </TableHead>
                  {/*  <TableHead className="w-[6.5rem] text-right">
                    Загальна сума
                  </TableHead> */}
                  <TableHead className="w-[18%]">Нотатки</TableHead>
                  {/*  <TableHead className="w-16 text-right">
                      Використання
                    </TableHead> */}
                  <TableHead className="w-[7.5rem] text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((material) => {
                  const formId = `material-update-${material.id}`
                  return (
                    <TableRow key={material.id} className="align-top">
                      <TableCell>
                        <Input
                          form={formId}
                          name="name"
                          defaultValue={material.name}
                          className="w-full min-w-0"
                        />
                      </TableCell>

                      <TableCell>
                        <Select
                          form={formId}
                          name="category"
                          defaultValue={material.category}
                          className="w-full"
                        >
                          {MATERIAL_CATEGORIES.map((entry) => (
                            <option key={entry} value={entry}>
                              {getMaterialCategoryLabel(entry)}
                            </option>
                          ))}
                        </Select>
                      </TableCell>

                      <TableCell>
                        <Input
                          form={formId}
                          name="color"
                          defaultValue={material.color}
                          placeholder="Без кольору"
                          className="w-full"
                        />
                      </TableCell>

                      <TableCell>
                        <Input
                          form={formId}
                          name="unit"
                          defaultValue={material.unit}
                          className="w-full"
                        />
                      </TableCell>

                      <TableCell className="text-right">
                        <Input
                          form={formId}
                          name="stockQty"
                          type="number"
                          min="0"
                          step="0.001"
                          defaultValue={material.stockQty}
                          className="w-full text-right"
                        />
                      </TableCell>

                      <TableCell className="text-right">
                        <Input
                          form={formId}
                          name="unitCostUAH"
                          type="number"
                          min="0"
                          step="0.001"
                          defaultValue={material.unitCostUAH}
                          className="w-full text-right"
                        />
                      </TableCell>

                      {/* <TableCell className="text-right text-sm font-medium">
                        {formatUAH(material.stockQty * material.unitCostUAH)}
                      </TableCell> */}

                      <TableCell>
                        <Textarea
                          form={formId}
                          name="notes"
                          defaultValue={material.notes ?? ''}
                          className="min-h-24 w-full resize-y"
                        />
                      </TableCell>

                      {/* <TableCell className="text-right">
                        {formatQuantity(material._count.productUsages)}
                      </TableCell> */}

                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-3">
                          <form id={formId} action={updateMaterial}>
                            <input
                              type="hidden"
                              name="id"
                              value={material.id}
                            />
                            <Button type="submit" size="sm">
                              Зберегти
                            </Button>
                          </form>

                          <form action={deleteMaterial}>
                            <input
                              type="hidden"
                              name="id"
                              value={material.id}
                            />
                            <ConfirmSubmitButton
                              confirmMessage={`Видалити матеріал "${material.name}"? Це також прибере його з усіх товарів.`}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Видалити
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
