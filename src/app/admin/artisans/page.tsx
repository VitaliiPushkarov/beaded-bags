import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { redirect } from 'next/navigation'
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
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    artisan?: string
    vq?: string
    createdCode?: string
    createdName?: string
    ratesUpdated?: string
    ratesCount?: string
  }>
}

const CreateArtisanSchema = z.object({
  name: z.string().trim().min(2),
  accessCode: z.string().trim().optional(),
})

const UpdateArtisanSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(2),
  accessCode: z.string().trim().min(3),
  isActive: z.enum(['true', 'false']),
})

function toBool(value: 'true' | 'false'): boolean {
  return value === 'true'
}

function normalizeAccessCode(raw?: string): string | null {
  const value = raw?.trim()
  if (!value) return null
  return value
}

function buildVariantLabel(variant: {
  id: string
  sku: string | null
  color: string | null
  modelSize: string | null
  pouchColor: string | null
  product: {
    name: string
    slug: string
  }
}): string {
  const detail =
    variant.color?.trim() ||
    variant.modelSize?.trim() ||
    variant.pouchColor?.trim() ||
    variant.sku?.trim() ||
    variant.id.slice(0, 8)

  return `${variant.product.name} • ${detail}`
}

async function generateUniqueAccessCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const exists = await prisma.artisan.findFirst({
      where: {
        accessCode: {
          equals: code,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    })

    if (!exists) return code
  }

  throw new Error('Не вдалося згенерувати унікальний код доступу')
}

export default async function AdminArtisansPage({ searchParams }: PageProps) {
  const params = await searchParams
  const selectedArtisanIdFromQuery = params.artisan?.trim() || ''
  const variantQuery = params.vq?.trim() || ''
  const createdCode = params.createdCode?.trim() || ''
  const createdName = params.createdName?.trim() || ''
  const ratesUpdated = params.ratesUpdated?.trim() === '1'
  const ratesCountRaw = params.ratesCount?.trim() || ''
  const ratesCount = Number.parseInt(ratesCountRaw, 10)
  const hasRatesCount = Number.isFinite(ratesCount) && ratesCount > 0
  const createdLink = createdCode
    ? `https://t.me/ProductionGerdan_bot?start=${encodeURIComponent(createdCode)}`
    : ''

  async function createArtisan(formData: FormData) {
    'use server'

    const parsed = CreateArtisanSchema.safeParse({
      name: formData.get('name'),
      accessCode: formData.get('accessCode'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося створити майстра')
    }

    const manualCode = normalizeAccessCode(parsed.data.accessCode)
    const accessCode = manualCode ?? (await generateUniqueAccessCode())

    const created = await prisma.artisan.create({
      data: {
        name: parsed.data.name,
        accessCode,
        isActive: true,
      },
    })

    redirect(
      `/admin/artisans?createdCode=${encodeURIComponent(created.accessCode)}&createdName=${encodeURIComponent(created.name)}`,
    )
  }

  async function updateArtisan(formData: FormData) {
    'use server'

    const parsed = UpdateArtisanSchema.safeParse({
      id: formData.get('id'),
      name: formData.get('name'),
      accessCode: formData.get('accessCode'),
      isActive: formData.get('isActive'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося оновити майстра')
    }

    await prisma.artisan.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        accessCode: parsed.data.accessCode,
        isActive: toBool(parsed.data.isActive),
      },
    })

    revalidatePath('/admin/artisans')
  }

  async function clearTelegramBinding(formData: FormData) {
    'use server'

    const id = String(formData.get('id') || '').trim()
    if (!id) return

    await prisma.artisan.update({
      where: { id },
      data: {
        telegramUserId: null,
        telegramChatId: null,
        telegramUsername: null,
      },
    })

    revalidatePath('/admin/artisans')
  }

  async function toggleArtisanActive(formData: FormData) {
    'use server'

    const id = String(formData.get('id') || '').trim()
    const next = String(formData.get('next') || '').trim()
    if (!id || (next !== 'true' && next !== 'false')) return

    await prisma.artisan.update({
      where: { id },
      data: {
        isActive: next === 'true',
      },
    })

    revalidatePath('/admin/artisans')
  }

  async function deleteArtisan(formData: FormData) {
    'use server'

    const id = String(formData.get('id') || '').trim()
    if (!id) return

    await prisma.artisan.delete({
      where: { id },
    })

    revalidatePath('/admin/artisans')
  }

  async function upsertRatesFromTable(formData: FormData) {
    'use server'

    const artisanId = String(formData.get('artisanId') || '').trim()
    const selectedVariantIds = formData
      .getAll('selectedVariantIds')
      .map((value) => String(value).trim())
      .filter(Boolean)

    if (!artisanId) {
      throw new Error('Некоректний майстер для додавання ставок')
    }

    if (selectedVariantIds.length === 0) {
      throw new Error('Оберіть хоча б один варіант')
    }

    const uniqueVariantIds = Array.from(new Set(selectedVariantIds))
    const payload = uniqueVariantIds.map((variantId) => {
      const rateRaw = String(formData.get(`rate_${variantId}`) || '').trim()
      const rate = Number(rateRaw)
      if (!Number.isInteger(rate) || rate < 1 || rate > 100000) {
        throw new Error(`Некоректна ставка для варіанта ${variantId}`)
      }

      return { variantId, ratePerUnitUAH: rate }
    })

    await prisma.$transaction(
      payload.map((entry) =>
        prisma.artisanRate.upsert({
          where: {
            artisanId_variantId: {
              artisanId,
              variantId: entry.variantId,
            },
          },
          create: {
            artisanId,
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

    revalidatePath('/admin/artisans')
    redirect(
      `/admin/artisans?artisan=${encodeURIComponent(artisanId)}&ratesUpdated=1&ratesCount=${payload.length}#edit-artisan`,
    )
  }

  const artisans = await prisma.artisan.findMany({
    include: {
      _count: {
        select: {
          rates: true,
          productions: true,
        },
      },
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    take: 200,
  })

  const selectedArtisan =
    artisans.find((artisan) => artisan.id === selectedArtisanIdFromQuery) ??
    null

  const selectedArtisanId = selectedArtisan?.id ?? ''

  const rates = selectedArtisan
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
  const ratesByVariantId = new Map(rates.map((rate) => [rate.variantId, rate]))

  const variantOptions = selectedArtisan
    ? await prisma.productVariant.findMany({
        where: variantQuery
          ? {
              OR: [
                { id: { contains: variantQuery, mode: 'insensitive' } },
                { sku: { contains: variantQuery, mode: 'insensitive' } },
                { color: { contains: variantQuery, mode: 'insensitive' } },
                { modelSize: { contains: variantQuery, mode: 'insensitive' } },
                { pouchColor: { contains: variantQuery, mode: 'insensitive' } },
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
  const rateTableRows = variantOptions
    .map((variant) => ({
      id: variant.id,
      label: buildVariantLabel(variant),
      currentRate: ratesByVariantId.get(variant.id)?.ratePerUnitUAH ?? null,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'uk'))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Майстри (Artisan)</h1>
        <p className="mt-1 text-sm text-gray-600">
          Керування майстрами, Telegram-прив&apos;язками та ставками по
          варіантах.
        </p>
      </div>

      {createdCode ? (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-emerald-900">Майстра створено</CardTitle>
            <CardDescription className="text-emerald-900/80">
              {createdName ? `Майстер: ${createdName}. ` : ''}Передай майстру
              цей лінк для прив&apos;язки.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm text-emerald-950">
              <b>Код:</b> <code>{createdCode}</code>
            </div>
            <div className="break-all rounded-md border border-emerald-300 bg-white p-3 text-sm">
              <a
                href={createdLink}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {createdLink}
              </a>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {ratesUpdated && selectedArtisan ? (
        <Card className="border-emerald-300 bg-emerald-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-emerald-900">
              Ставки оновлено
            </CardTitle>
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
            Створи майстра. Якщо код доступу порожній, згенерується автоматично.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createArtisan} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="artisan-name">Ім&apos;я та прізвище</Label>
              <Input id="artisan-name" name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="artisan-access-code">Код доступу</Label>
              <Input
                id="artisan-access-code"
                name="accessCode"
                placeholder="123456"
              />
            </div>
            <div className="sm:col-span-3">
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
                  <TableHead>Код</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Telegram</TableHead>
                  <TableHead>Ставок</TableHead>
                  <TableHead>Записів</TableHead>
                  <TableHead className="w-[240px] text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artisans.map((artisan) => (
                  <TableRow key={artisan.id}>
                    <TableCell className="font-medium">
                      {artisan.name}
                    </TableCell>
                    <TableCell>
                      <code>{artisan.accessCode}</code>
                    </TableCell>
                    <TableCell>
                      {artisan.isActive ? 'Активний' : 'Неактивний'}
                    </TableCell>
                    <TableCell>
                      {artisan.telegramUserId ? (
                        <div className="space-y-0.5 text-xs text-slate-700">
                          <div>
                            user: <code>{artisan.telegramUserId}</code>
                          </div>
                          <div>
                            chat: <code>{artisan.telegramChatId ?? '—'}</code>
                          </div>
                          <div>@{artisan.telegramUsername ?? '—'}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Не прив&apos;язано
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{artisan._count.rates}</TableCell>
                    <TableCell>{artisan._count.productions}</TableCell>
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
                            confirmMessage="Видалити цього майстра? Це також видалить його ставки та записи виробітку."
                            className="inline-flex h-9 items-center justify-center rounded-md border border-red-300 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                          >
                            Видалити майстра
                          </ConfirmSubmitButton>
                        </form>

                        {artisan.telegramUserId || artisan.telegramChatId ? (
                          <form action={clearTelegramBinding}>
                            <input type="hidden" name="id" value={artisan.id} />
                            <ConfirmSubmitButton
                              confirmMessage="Скинути Telegram-прив'язку для цього майстра?"
                              className="inline-flex h-9 items-center justify-center rounded-md border border-red-300 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                            >
                              Скинути Telegram
                            </ConfirmSubmitButton>
                          </form>
                        ) : null}
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
            <form action={updateArtisan} className="grid gap-4 sm:grid-cols-3">
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
                <Label htmlFor="artisan-edit-code">Код доступу</Label>
                <Input
                  id="artisan-edit-code"
                  name="accessCode"
                  required
                  defaultValue={selectedArtisan.accessCode}
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

              <div className="sm:col-span-3">
                <Button type="submit">Зберегти зміни</Button>
              </div>
            </form>

            <div className="rounded-lg border border-slate-200 p-4 space-y-6">
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
                  <Label htmlFor="variant-query">
                    Пошук варіанта для ставки
                  </Label>
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
