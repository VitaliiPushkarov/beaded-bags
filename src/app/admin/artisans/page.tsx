import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'
import ArtisanRatesTableForm from '@/components/admin/ArtisanRatesTableForm'
import { Button } from '@/components/ui/button'
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
import {
  buildArtisanRateTableRows,
  parseArtisanRateUpdatesFromFormData,
} from '@/lib/admin-artisans'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    artisan?: string
    vq?: string
    ratesUpdated?: string
    ratesCount?: string
    success?: string
    error?: string
    errorScope?: string
  }>
}

type ArtisanListItem = Prisma.ArtisanGetPayload<{
  include: {
    _count: {
      select: {
        rates: true
        adminProductions: true
      }
    }
  }
}>

type ArtisanRateWithVariant = Prisma.ArtisanRateGetPayload<{
  include: {
    variant: {
      select: {
        id: true
        sku: true
        color: true
        modelSize: true
        pouchColor: true
        product: {
          select: {
            name: true
            slug: true
          }
        }
      }
    }
  }
}>

type VariantOption = Prisma.ProductVariantGetPayload<{
  select: {
    id: true
    sku: true
    color: true
    modelSize: true
    pouchColor: true
    product: {
      select: {
        name: true
        slug: true
      }
    }
  }
}>

const CreateArtisanSchema = z.object({
  name: z.string().trim().min(2),
})

const UpdateArtisanSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(2),
  isActive: z.enum(['true', 'false']),
})

function toBool(value: 'true' | 'false'): boolean {
  return value === 'true'
}

export default async function AdminArtisansPage({ searchParams }: PageProps) {
  const params = await searchParams
  const selectedArtisanIdFromQuery = params.artisan?.trim() || ''
  const variantQuery = params.vq?.trim() || ''
  const ratesUpdated = params.ratesUpdated?.trim() === '1'
  const ratesCountRaw = params.ratesCount?.trim() || ''
  const ratesCount = Number.parseInt(ratesCountRaw, 10)
  const hasRatesCount = Number.isFinite(ratesCount) && ratesCount > 0
  const successMessage = params.success?.trim() || ''
  const errorMessage = params.error?.trim() || ''
  const errorScope = params.errorScope?.trim() || ''

  async function createArtisan(formData: FormData) {
    'use server'

    const parsed = CreateArtisanSchema.safeParse({
      name: formData.get('name'),
    })

    if (!parsed.success) {
      redirect(
        `/admin/artisans?errorScope=create-artisan&error=${encodeURIComponent('Перевірте імʼя майстра (мінімум 2 символи).')}`,
      )
    }

    const name = parsed.data.name

    try {
      await prisma.artisan.create({
        data: {
          name,
          isActive: true,
        },
      })
    } catch (error) {
      console.error('[admin/artisans] createArtisan failed', error)
      redirect(
        `/admin/artisans?errorScope=create-artisan&error=${encodeURIComponent('Не вдалося створити майстра. Спробуйте ще раз.')}`,
      )
    }

    revalidatePath('/admin/artisans')
    redirect(
      `/admin/artisans?success=${encodeURIComponent(`Майстра «${name}» створено.`)}`,
    )
  }

  async function updateArtisan(formData: FormData) {
    'use server'

    const parsed = UpdateArtisanSchema.safeParse({
      id: formData.get('id'),
      name: formData.get('name'),
      isActive: formData.get('isActive'),
    })

    if (!parsed.success) {
      redirect(
        `/admin/artisans?artisan=${encodeURIComponent(selectedArtisanIdFromQuery)}&errorScope=edit-artisan&error=${encodeURIComponent('Перевірте дані: імʼя від 2 символів.')}`,
      )
    }

    try {
      await prisma.artisan.update({
        where: { id: parsed.data.id },
        data: {
          name: parsed.data.name,
          isActive: toBool(parsed.data.isActive),
        },
      })
    } catch (error) {
      console.error('[admin/artisans] updateArtisan failed', error)
      redirect(
        `/admin/artisans?artisan=${encodeURIComponent(parsed.data.id)}&errorScope=edit-artisan&error=${encodeURIComponent('Не вдалося оновити майстра. Спробуйте ще раз.')}`,
      )
    }

    revalidatePath('/admin/artisans')
    redirect(
      `/admin/artisans?artisan=${encodeURIComponent(parsed.data.id)}&success=${encodeURIComponent('Дані майстра оновлено.')}#edit-artisan`,
    )
  }

  async function deleteArtisan(formData: FormData) {
    'use server'

    const id = String(formData.get('id') || '').trim()
    if (!id) return

    await prisma.artisan.delete({
      where: { id },
    })

    revalidatePath('/admin/artisans')
    redirect('/admin/artisans?success=' + encodeURIComponent('Майстра видалено.'))
  }

  async function upsertRatesFromTable(formData: FormData) {
    'use server'

    let parsed: {
      artisanId: string
      updates: Array<{
        variantId: string
        ratePerUnitUAH: number
      }>
    }

    try {
      parsed = parseArtisanRateUpdatesFromFormData(formData)
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Не вдалося прочитати дані ставок'
      const artisanId = String(formData.get('artisanId') || '').trim()
      redirect(
        `/admin/artisans?artisan=${encodeURIComponent(artisanId)}&errorScope=artisan-rates&error=${encodeURIComponent(message)}`,
      )
    }

    try {
      await prisma.$transaction(
        parsed.updates.map((entry) =>
          prisma.artisanRate.upsert({
            where: {
              artisanId_variantId: {
                artisanId: parsed.artisanId,
                variantId: entry.variantId,
              },
            },
            create: {
              artisanId: parsed.artisanId,
              variantId: entry.variantId,
              ratePerUnitUAH: entry.ratePerUnitUAH,
              isActive: true,
            },
            update: {
              ratePerUnitUAH: entry.ratePerUnitUAH,
              isActive: true,
            },
          }),
        ),
      )
    } catch (error) {
      console.error('[admin/artisans] upsertRatesFromTable failed', error)
      redirect(
        `/admin/artisans?artisan=${encodeURIComponent(parsed.artisanId)}&errorScope=artisan-rates&error=${encodeURIComponent('Не вдалося зберегти ставки. Перевірте дані і спробуйте ще раз.')}`,
      )
    }

    revalidatePath('/admin/artisans')
    redirect(
      `/admin/artisans?artisan=${encodeURIComponent(parsed.artisanId)}&ratesUpdated=1&ratesCount=${parsed.updates.length}#edit-artisan`,
    )
  }

  let artisans: ArtisanListItem[] = []
  let selectedArtisan: ArtisanListItem | null = null
  let selectedArtisanId = ''
  let rates: ArtisanRateWithVariant[] = []
  let variantOptions: VariantOption[] = []
  let rateTableRows: Array<{
    id: string
    label: string
    currentRate: number | null
  }> = []

  try {
    artisans = await prisma.artisan.findMany({
      include: {
        _count: {
          select: {
            rates: true,
            adminProductions: true,
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      take: 200,
    })

    selectedArtisan =
      artisans.find((artisan) => artisan.id === selectedArtisanIdFromQuery) ??
      null
    selectedArtisanId = selectedArtisan?.id ?? ''

    rates = selectedArtisan
      ? await prisma.artisanRate.findMany({
          where: { artisanId: selectedArtisan.id },
          include: {
            variant: {
              select: {
                id: true,
                sku: true,
                color: true,
                modelSize: true,
                pouchColor: true,
                product: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
          orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
          take: 300,
        })
      : []
    const ratesByVariantId = new Map(
      rates.map((rate) => [rate.variantId, rate]),
    )

    variantOptions = selectedArtisan
      ? await prisma.productVariant.findMany({
          where: variantQuery
            ? {
                OR: [
                  { id: { contains: variantQuery, mode: 'insensitive' } },
                  { sku: { contains: variantQuery, mode: 'insensitive' } },
                  { color: { contains: variantQuery, mode: 'insensitive' } },
                  {
                    modelSize: {
                      contains: variantQuery,
                      mode: 'insensitive',
                    },
                  },
                  {
                    pouchColor: {
                      contains: variantQuery,
                      mode: 'insensitive',
                    },
                  },
                  {
                    product: {
                      is: {
                        name: { contains: variantQuery, mode: 'insensitive' },
                      },
                    },
                  },
                  {
                    product: {
                      is: {
                        slug: { contains: variantQuery, mode: 'insensitive' },
                      },
                    },
                  },
                ],
              }
            : undefined,
          select: {
            id: true,
            sku: true,
            color: true,
            modelSize: true,
            pouchColor: true,
            product: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
          orderBy: [
            { product: { name: 'asc' } },
            { color: 'asc' },
            { modelSize: 'asc' },
            { pouchColor: 'asc' },
            { id: 'asc' },
          ],
        })
      : []

    rateTableRows = buildArtisanRateTableRows({
      variants: variantOptions,
      ratesByVariantId,
    })
  } catch (error) {
    console.error('[admin/artisans] page data load failed', error)
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Майстри</h1>
          <p className="mt-1 text-sm text-gray-600">
            Керування майстрами та ставками по варіантах.
          </p>
        </div>
        <Card className="border-red-300 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-900">Помилка</CardTitle>
            <CardDescription className="text-red-900/80">
              Не вдалося завантажити дані майстрів. Перевірте з&apos;єднання з
              базою даних і спробуйте ще раз.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Майстри</h1>
        <p className="mt-1 text-sm text-gray-600">
          Керування майстрами та ставками по варіантах.
        </p>
      </div>

      {successMessage ? (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-emerald-900">Успішно</CardTitle>
            <CardDescription className="text-emerald-900/80">
              {successMessage}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {errorMessage ? (
        <Card className="border-red-300 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-900">Помилка</CardTitle>
            <CardDescription className="text-red-900/80">
              {errorMessage}
            </CardDescription>
            {errorScope ? (
              <div className="text-xs text-red-900/70">
                Джерело: <code>{errorScope}</code>
              </div>
            ) : null}
          </CardHeader>
        </Card>
      ) : null}

      {ratesUpdated && selectedArtisan ? (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-emerald-900">Ставки оновлено</CardTitle>
            <CardDescription className="text-emerald-900/80">
              {hasRatesCount
                ? `Для майстра ${selectedArtisan.name} додано/оновлено ${ratesCount} ${
                    ratesCount === 1 ? 'ставку' : 'ставок'
                  }.`
                : `Для майстра ${selectedArtisan.name} ставки додано/оновлено.`}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Новий майстер</CardTitle>
          <CardDescription>
            Створи майстра для обліку виробництва і ставок.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createArtisan} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="artisan-name">Ім&apos;я та прізвище</Label>
              <Input id="artisan-name" name="name" required />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Створити майстра</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-200">
          <CardTitle>Список майстрів</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {artisans.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">Майстрів ще немає.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ім&apos;я</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Ставок</TableHead>
                  <TableHead className="text-right">Записів виробництва</TableHead>
                  <TableHead className="w-[260px] text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artisans.map((artisan) => (
                  <TableRow key={artisan.id}>
                    <TableCell className="font-medium">{artisan.name}</TableCell>
                    <TableCell>
                      {artisan.isActive ? 'Активний' : 'Неактивний'}
                    </TableCell>
                    <TableCell className="text-right">{artisan._count.rates}</TableCell>
                    <TableCell className="text-right">
                      {artisan._count.adminProductions}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/artisans?artisan=${encodeURIComponent(artisan.id)}#edit-artisan`}
                          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
                        >
                          Редагувати
                        </Link>

                        <form action={deleteArtisan}>
                          <input type="hidden" name="id" value={artisan.id} />
                          <ConfirmSubmitButton
                            confirmMessage="Видалити цього майстра? Це також видалить його ставки та записи виробництва."
                            className="inline-flex h-9 items-center justify-center rounded-md border border-red-300 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                          >
                            Видалити
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedArtisan ? (
        <Card id="edit-artisan">
          <CardHeader>
            <CardTitle>Редагування майстра</CardTitle>
            <CardDescription>
              Оновлення даних для: <b>{selectedArtisan.name}</b>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form action={updateArtisan} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={selectedArtisan.id} />

              <div className="space-y-1.5">
                <Label htmlFor="artisan-edit-name">Ім&apos;я</Label>
                <Input
                  id="artisan-edit-name"
                  name="name"
                  required
                  defaultValue={selectedArtisan.name}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="artisan-edit-status">Статус</Label>
                <Select
                  id="artisan-edit-status"
                  name="isActive"
                  defaultValue={selectedArtisan.isActive ? 'true' : 'false'}
                >
                  <option value="true">Активний</option>
                  <option value="false">Неактивний</option>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Button type="submit">Зберегти зміни</Button>
              </div>
            </form>

            <div className="space-y-6 rounded-lg border border-slate-200 p-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Ставки по варіантах
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Додай одну або декілька ставок для майстра:{' '}
                  <b>{selectedArtisan.name}</b>
                </p>
              </div>

              <form method="get" className="grid gap-3 sm:grid-cols-4">
                <input type="hidden" name="artisan" value={selectedArtisanId} />
                <div className="space-y-1.5 sm:col-span-3">
                  <Label htmlFor="variant-query">Пошук варіанта для ставки</Label>
                  <Input
                    id="variant-query"
                    name="vq"
                    defaultValue={variantQuery}
                    placeholder="id / sku / колір / назва / slug"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="outline">
                    Знайти
                  </Button>
                </div>
              </form>

              {variantOptions.length === 0 ? (
                <div className="rounded-md border border-slate-200 p-4 text-sm text-slate-600">
                  За поточним пошуком варіанти не знайдено.
                </div>
              ) : (
                <ArtisanRatesTableForm
                  artisanId={selectedArtisanId}
                  variants={rateTableRows}
                  action={upsertRatesFromTable}
                />
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
