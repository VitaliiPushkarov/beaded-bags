import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  AdminProductionItemType,
  ExpenseCategory,
  Prisma,
} from '@prisma/client'

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
import { endOfDay, formatDate, formatUAH, startOfDay, toDateInputValue } from '@/lib/admin-finance'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    artisan?: string
    from?: string
    to?: string
    report?: string
    success?: string
    error?: string
  }>
}

type AdminProductionWithRelations = Prisma.AdminProductionGetPayload<{
  include: {
    artisan: {
      select: {
        id: true
        name: true
      }
    }
    product: {
      select: {
        id: true
        name: true
        slug: true
      }
    }
    variant: {
      select: {
        id: true
        sku: true
        color: true
        modelSize: true
        pouchColor: true
      }
    }
  }
}>

type ArtisanRateOption = Prisma.ArtisanRateGetPayload<{
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
            id: true
            name: true
            slug: true
          }
        }
      }
    }
  }
}>

function parseDateInput(raw?: string): Date | null {
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function getVariantDetail(variant?: {
  id: string
  sku: string | null
  color: string | null
  modelSize: string | null
  pouchColor: string | null
} | null): string {
  if (!variant) return '—'

  return (
    variant.color?.trim() ||
    variant.modelSize?.trim() ||
    variant.pouchColor?.trim() ||
    variant.sku?.trim() ||
    variant.id.slice(0, 8)
  )
}

function normalizeReturnTo(formData: FormData): string {
  const raw = String(formData.get('returnTo') || '').trim()
  return raw.startsWith('/admin/production') ? raw : '/admin/production'
}

function withQueryMessage(returnTo: string, next: { success?: string; error?: string }) {
  const url = new URL(returnTo, 'http://localhost')

  if (next.success) {
    url.searchParams.set('success', next.success)
    url.searchParams.delete('error')
  }

  if (next.error) {
    url.searchParams.set('error', next.error)
    url.searchParams.delete('success')
  }

  return `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''}`
}

function parsePositiveInt(raw: string, min: number, max: number): number | null {
  const value = Number.parseInt(raw, 10)
  if (!Number.isInteger(value) || value < min || value > max) return null
  return value
}

function buildProductionExpenseTitle(production: {
  artisanName: string
  itemName: string
}): string {
  return `${production.artisanName}: ${production.itemName}`
}

function buildProductionItemLabel(production: AdminProductionWithRelations): string {
  if (production.itemType === AdminProductionItemType.CUSTOM_ITEM) {
    return production.customItemName?.trim() || 'Унікальний виріб'
  }

  const productName = production.product?.name || 'Товар з каталогу'
  const detail = getVariantDetail(production.variant)
  return `${productName} • ${detail}`
}

export default async function AdminProductionPage({ searchParams }: PageProps) {
  const params = await searchParams
  const parsedFrom = parseDateInput(params.from)
  const parsedTo = parseDateInput(params.to)
  const now = new Date()

  const from = parsedFrom
    ? startOfDay(parsedFrom)
    : startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000))
  const to = parsedTo ? endOfDay(parsedTo) : endOfDay(now)

  const selectedArtisanId = params.artisan?.trim() || ''
  const showReport = params.report === '1'
  const successMessage = params.success?.trim() || ''
  const errorMessage = params.error?.trim() || ''

  async function createAdminProduction(formData: FormData) {
    'use server'

    const returnTo = normalizeReturnTo(formData)

    const artisanId = String(formData.get('artisanId') || '').trim()
    const itemTypeRaw = String(
      formData.get('itemType') || AdminProductionItemType.CATALOG_VARIANT,
    ).trim()
    const itemType =
      itemTypeRaw === AdminProductionItemType.CUSTOM_ITEM
        ? AdminProductionItemType.CUSTOM_ITEM
        : AdminProductionItemType.CATALOG_VARIANT
    const variantId = String(formData.get('variantId') || '').trim()
    const customItemName = String(formData.get('customItemName') || '').trim()
    const qtyRaw = String(formData.get('qty') || '').trim()
    const rateRaw = String(formData.get('ratePerUnitUAH') || '').trim()
    const producedAtRaw = String(formData.get('producedAt') || '').trim()
    const notes = String(formData.get('notes') || '').trim()

    const qty = parsePositiveInt(qtyRaw, 1, 100000)
    if (!artisanId || !qty) {
      redirect(
        withQueryMessage(returnTo, {
          error: 'Перевірте майстра і кількість (ціле число від 1 до 100000).',
        }),
      )
    }

    const producedAt = parseDateInput(producedAtRaw)
    if (!producedAt) {
      redirect(
        withQueryMessage(returnTo, {
          error: 'Вкажіть коректну дату виробництва.',
        }),
      )
    }

    const parsedRate = rateRaw ? parsePositiveInt(rateRaw, 1, 1000000) : null
    if (rateRaw && !parsedRate) {
      redirect(
        withQueryMessage(returnTo, {
          error: 'Ставка має бути цілим числом від 1 до 1000000.',
        }),
      )
    }

    try {
      await prisma.$transaction(async (tx) => {
        const artisan = await tx.artisan.findUnique({
          where: { id: artisanId },
          select: { id: true },
        })

        if (!artisan) {
          throw new Error('Майстра не знайдено')
        }

        if (itemType === AdminProductionItemType.CATALOG_VARIANT) {
          if (!variantId) {
            throw new Error('Оберіть варіант товару для запису з каталогу')
          }

          const variant = await tx.productVariant.findUnique({
            where: { id: variantId },
            select: {
              id: true,
              productId: true,
            },
          })

          if (!variant) {
            throw new Error('Варіант товару не знайдено')
          }

          const rateFromTable = await tx.artisanRate.findFirst({
            where: {
              artisanId,
              variantId,
              isActive: true,
            },
            select: {
              ratePerUnitUAH: true,
            },
          })

          const ratePerUnitUAH = parsedRate ?? rateFromTable?.ratePerUnitUAH ?? null

          if (!ratePerUnitUAH) {
            throw new Error('Для цього варіанта немає ставки. Вкажіть ставку вручну або додайте її у ставках майстра.')
          }

          await tx.adminProduction.create({
            data: {
              artisanId,
              itemType: AdminProductionItemType.CATALOG_VARIANT,
              productId: variant.productId,
              variantId: variant.id,
              qty,
              ratePerUnitUAH,
              totalLaborUAH: qty * ratePerUnitUAH,
              producedAt,
              status: 'SUBMITTED',
              notes: notes || null,
            },
          })

          return
        }

        if (customItemName.length < 2) {
          throw new Error('Для унікального товару вкажіть назву мінімум 2 символи')
        }

        if (!parsedRate) {
          throw new Error('Для унікального товару ставка обов’язкова')
        }

        await tx.adminProduction.create({
          data: {
            artisanId,
            itemType: AdminProductionItemType.CUSTOM_ITEM,
            customItemName,
            qty,
            ratePerUnitUAH: parsedRate,
            totalLaborUAH: qty * parsedRate,
            producedAt,
            status: 'SUBMITTED',
            notes: notes || null,
          },
        })
      })
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Не вдалося додати запис виробництва'

      redirect(withQueryMessage(returnTo, { error: message }))
    }

    revalidatePath('/admin/production')
    redirect(withQueryMessage(returnTo, { success: 'Запис виробництва додано.' }))
  }

  async function reimburseDebt(formData: FormData) {
    'use server'

    const returnTo = normalizeReturnTo(formData)
    const productionId = String(formData.get('productionId') || '').trim()
    const modeRaw = String(formData.get('mode') || 'FULL').trim()
    const mode = modeRaw === 'PARTIAL' ? 'PARTIAL' : 'FULL'
    const amountRaw = String(formData.get('amountUAH') || '').trim()

    if (!productionId) {
      redirect(withQueryMessage(returnTo, { error: 'Некоректний запис виробництва.' }))
    }

    try {
      await prisma.$transaction(async (tx) => {
        const production = await tx.adminProduction.findUnique({
          where: { id: productionId },
          include: {
            artisan: {
              select: {
                name: true,
              },
            },
            product: {
              select: {
                name: true,
              },
            },
            variant: {
              select: {
                id: true,
                sku: true,
                color: true,
                modelSize: true,
                pouchColor: true,
              },
            },
          },
        })

        if (!production) {
          throw new Error('Запис виробництва не знайдено')
        }

        const currentDebt = Math.max(0, production.totalLaborUAH - production.settledAmountUAH)
        if (currentDebt === 0) {
          throw new Error('Цей запис вже повністю відшкодовано')
        }

        const partialAmount = parsePositiveInt(amountRaw, 1, 1000000)
        const settledNowUAH = mode === 'FULL' ? currentDebt : partialAmount

        if (!settledNowUAH) {
          throw new Error('Вкажіть коректну суму відшкодування')
        }

        if (settledNowUAH > currentDebt) {
          throw new Error('Сума відшкодування не може перевищувати поточний борг')
        }

        const itemName =
          production.itemType === AdminProductionItemType.CUSTOM_ITEM
            ? production.customItemName?.trim() || 'Унікальний виріб'
            : `${production.product?.name || 'Товар з каталогу'} (${getVariantDetail(production.variant)})`

        const expenseTitle = buildProductionExpenseTitle({
          artisanName: production.artisan.name,
          itemName,
        })

        const expense = await tx.expense.create({
          data: {
            title: expenseTitle,
            category: ExpenseCategory.PAYROLL,
            amountUAH: settledNowUAH,
            expenseDate: new Date(),
            notes: null,
          },
        })

        await tx.adminProductionSettlement.create({
          data: {
            productionId: production.id,
            amountUAH: settledNowUAH,
            expenseId: expense.id,
            note: mode === 'FULL' ? 'Повне погашення боргу' : 'Часткове погашення боргу',
          },
        })

        const nextSettledAmount = production.settledAmountUAH + settledNowUAH
        const isFullyPaid = nextSettledAmount >= production.totalLaborUAH

        await tx.adminProduction.update({
          where: { id: production.id },
          data: {
            settledAmountUAH: nextSettledAmount,
            status: isFullyPaid ? 'PAID' : 'SUBMITTED',
            paidAt: isFullyPaid ? new Date() : null,
            paidExpenseId: expense.id,
          },
        })
      })
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Не вдалося відшкодувати борг'
      redirect(withQueryMessage(returnTo, { error: message }))
    }

    revalidatePath('/admin/production')
    revalidatePath('/admin/expenses')
    revalidatePath('/admin/finance')
    redirect(withQueryMessage(returnTo, { success: 'Відшкодування збережено.' }))
  }

  const artisans = await prisma.artisan.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ name: 'asc' }],
    select: {
      id: true,
      name: true,
    },
  })

  const selectedArtisan =
    artisans.find((artisan) => artisan.id === selectedArtisanId) ?? null

  const variantRateOptions: ArtisanRateOption[] = selectedArtisan
    ? await prisma.artisanRate.findMany({
        where: {
          artisanId: selectedArtisan.id,
          isActive: true,
        },
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
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: [
          { variant: { product: { name: 'asc' } } },
          { variant: { color: 'asc' } },
          { variant: { modelSize: 'asc' } },
          { variant: { pouchColor: 'asc' } },
          { updatedAt: 'desc' },
        ],
      })
    : []

  const where: Prisma.AdminProductionWhereInput = {
    producedAt: {
      gte: from,
      lte: to,
    },
    ...(selectedArtisan ? { artisanId: selectedArtisan.id } : {}),
  }

  const productions = await prisma.adminProduction.findMany({
    where,
    include: {
      artisan: {
        select: {
          id: true,
          name: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      variant: {
        select: {
          id: true,
          sku: true,
          color: true,
          modelSize: true,
          pouchColor: true,
        },
      },
    },
    orderBy: [{ producedAt: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  })

  const reportMap = new Map<
    string,
    {
      artisanId: string
      artisanName: string
      entries: number
      qty: number
      totalLaborUAH: number
      settledUAH: number
      debtUAH: number
    }
  >()

  for (const production of productions) {
    const current = reportMap.get(production.artisanId) ?? {
      artisanId: production.artisanId,
      artisanName: production.artisan.name,
      entries: 0,
      qty: 0,
      totalLaborUAH: 0,
      settledUAH: 0,
      debtUAH: 0,
    }

    current.entries += 1
    current.qty += production.qty
    current.totalLaborUAH += production.totalLaborUAH
    current.settledUAH += production.settledAmountUAH
    current.debtUAH += Math.max(0, production.totalLaborUAH - production.settledAmountUAH)

    reportMap.set(production.artisanId, current)
  }

  const reportRows = Array.from(reportMap.values()).sort((a, b) =>
    a.artisanName.localeCompare(b.artisanName, 'uk'),
  )

  const totalLaborSum = reportRows.reduce((sum, row) => sum + row.totalLaborUAH, 0)
  const totalSettledSum = reportRows.reduce((sum, row) => sum + row.settledUAH, 0)
  const totalDebtSum = reportRows.reduce((sum, row) => sum + row.debtUAH, 0)

  const fromInputValue = toDateInputValue(from)
  const toInputValue = toDateInputValue(to)

  const baseParams = new URLSearchParams({
    ...(selectedArtisan ? { artisan: selectedArtisan.id } : {}),
    from: fromInputValue,
    to: toInputValue,
  })
  const reportHref = `/admin/production?${new URLSearchParams({
    ...Object.fromEntries(baseParams.entries()),
    report: '1',
  }).toString()}#report`
  if (showReport) {
    baseParams.set('report', '1')
  }
  const baseReturnTo = `/admin/production?${baseParams.toString()}`

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Виробництво (Admin)</h1>
          <p className="mt-1 text-sm text-gray-600">
            Облік виробництва майстрів, унікальних виробів, боргу та відшкодувань.
          </p>
        </div>

        <Link href={reportHref} className={buttonVariants({ variant: 'outline' })}>
          Звіт
        </Link>
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
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Фільтри</CardTitle>
          <CardDescription>
            Оберіть майстра і період для роботи та звіту.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="production-artisan">Майстер</Label>
              <Select
                id="production-artisan"
                name="artisan"
                defaultValue={selectedArtisan?.id ?? ''}
              >
                <option value="">Усі майстри</option>
                {artisans.map((artisan) => (
                  <option key={artisan.id} value={artisan.id}>
                    {artisan.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="production-from">Від</Label>
              <Input id="production-from" type="date" name="from" defaultValue={fromInputValue} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="production-to">До</Label>
              <Input id="production-to" type="date" name="to" defaultValue={toInputValue} />
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit">Застосувати</Button>
              <Link href="/admin/production" className={buttonVariants({ variant: 'outline' })}>
                Скинути
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Додати виробництво</CardTitle>
          <CardDescription>
            Створення запису для каталожного або унікального товару (без додавання в каталог).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedArtisan ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Щоб додати запис виробництва, спочатку оберіть майстра у фільтрах.
            </div>
          ) : (
            <form action={createAdminProduction} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="artisanId" value={selectedArtisan.id} />
              <input type="hidden" name="returnTo" value={baseReturnTo} />

              <div className="space-y-1.5">
                <Label htmlFor="production-item-type">Тип запису</Label>
                <Select
                  id="production-item-type"
                  name="itemType"
                  defaultValue={AdminProductionItemType.CATALOG_VARIANT}
                >
                  <option value={AdminProductionItemType.CATALOG_VARIANT}>
                    Товар з каталогу
                  </option>
                  <option value={AdminProductionItemType.CUSTOM_ITEM}>
                    Унікальний товар (без каталогу)
                  </option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="production-variant">Варіант (для каталогу)</Label>
                <Select id="production-variant" name="variantId" defaultValue="">
                  <option value="">Оберіть варіант</option>
                  {variantRateOptions.map((rate) => (
                    <option key={rate.variantId} value={rate.variantId}>
                      {rate.variant.product.name} • {getVariantDetail(rate.variant)} • {rate.ratePerUnitUAH}₴/шт
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="production-custom-name">Назва унікального товару</Label>
                <Input
                  id="production-custom-name"
                  name="customItemName"
                  placeholder="Наприклад: Індивідуальний браслет"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="production-rate">Ставка, грн/шт</Label>
                <Input
                  id="production-rate"
                  name="ratePerUnitUAH"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Для каталогу: можна лишити порожнім"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="production-qty">Кількість</Label>
                <Input
                  id="production-qty"
                  name="qty"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  defaultValue="1"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="production-date">Дата виробництва</Label>
                <Input
                  id="production-date"
                  name="producedAt"
                  type="date"
                  defaultValue={toDateInputValue(new Date())}
                  required
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="production-notes">Нотатки</Label>
                <Input id="production-notes" name="notes" placeholder="Опціонально" />
              </div>

              <div className="md:col-span-2">
                <Button type="submit">Додати запис</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card id="report" className="overflow-hidden">
        <CardHeader className="border-b border-slate-200">
          <CardTitle>Звіт по майстрах</CardTitle>
          <CardDescription>
            За період: {formatDate(from)} — {formatDate(to)}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {showReport && reportRows.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">За обраний період немає записів.</div>
          ) : !showReport ? (
            <div className="p-6 text-sm text-slate-600">
              Натисніть кнопку <b>Звіт</b>, щоб показати агреговані підсумки по майстрах.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Майстер</TableHead>
                  <TableHead className="text-right">Записів</TableHead>
                  <TableHead className="text-right">К-сть</TableHead>
                  <TableHead className="text-right">Нараховано</TableHead>
                  <TableHead className="text-right">Відшкодовано</TableHead>
                  <TableHead className="text-right">Борг</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportRows.map((row) => (
                  <TableRow key={row.artisanId}>
                    <TableCell className="font-medium">{row.artisanName}</TableCell>
                    <TableCell className="text-right">{row.entries}</TableCell>
                    <TableCell className="text-right">{row.qty}</TableCell>
                    <TableCell className="text-right">{formatUAH(row.totalLaborUAH)}</TableCell>
                    <TableCell className="text-right">{formatUAH(row.settledUAH)}</TableCell>
                    <TableCell className="text-right font-medium">{formatUAH(row.debtUAH)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-slate-50 font-medium">
                  <TableCell>Всього</TableCell>
                  <TableCell className="text-right">
                    {reportRows.reduce((sum, row) => sum + row.entries, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {reportRows.reduce((sum, row) => sum + row.qty, 0)}
                  </TableCell>
                  <TableCell className="text-right">{formatUAH(totalLaborSum)}</TableCell>
                  <TableCell className="text-right">{formatUAH(totalSettledSum)}</TableCell>
                  <TableCell className="text-right">{formatUAH(totalDebtSum)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-200">
          <CardTitle>Записи виробництва</CardTitle>
          <CardDescription>
            Нарахування, часткові погашення та повне закриття боргу.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {productions.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">За обраний період записів немає.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Майстер</TableHead>
                  <TableHead>Позиція</TableHead>
                  <TableHead className="text-right">К-сть</TableHead>
                  <TableHead className="text-right">Ставка</TableHead>
                  <TableHead className="text-right">Нараховано</TableHead>
                  <TableHead className="text-right">Відшкодовано</TableHead>
                  <TableHead className="text-right">Борг</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-[320px] text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productions.map((production) => {
                  const debtUAH = Math.max(0, production.totalLaborUAH - production.settledAmountUAH)
                  const isPaid = debtUAH === 0

                  return (
                    <TableRow key={production.id}>
                      <TableCell>{formatDate(production.producedAt)}</TableCell>
                      <TableCell className="font-medium">{production.artisan.name}</TableCell>
                      <TableCell>
                        <div className="font-medium">{buildProductionItemLabel(production)}</div>
                        <div className="text-xs text-slate-500">
                          {production.itemType ===
                          AdminProductionItemType.CUSTOM_ITEM
                            ? 'Унікальний товар'
                            : 'Каталог'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{production.qty}</TableCell>
                      <TableCell className="text-right">{formatUAH(production.ratePerUnitUAH)}</TableCell>
                      <TableCell className="text-right font-medium">{formatUAH(production.totalLaborUAH)}</TableCell>
                      <TableCell className="text-right">{formatUAH(production.settledAmountUAH)}</TableCell>
                      <TableCell className="text-right">{formatUAH(debtUAH)}</TableCell>
                      <TableCell>{isPaid ? 'Оплачено' : 'Борг'}</TableCell>
                      <TableCell>
                        {isPaid ? (
                          <div className="text-right text-xs text-slate-500">
                            Закрито {production.paidAt ? formatDate(production.paidAt) : ''}
                          </div>
                        ) : (
                          <form action={reimburseDebt} className="flex items-center justify-end gap-2">
                            <input type="hidden" name="productionId" value={production.id} />
                            <input type="hidden" name="returnTo" value={baseReturnTo} />
                            <Input
                              name="amountUAH"
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              defaultValue={String(debtUAH)}
                              className="h-9 w-24"
                            />
                            <Button type="submit" name="mode" value="PARTIAL" variant="outline" size="sm">
                              Зберегти
                            </Button>
                            <Button type="submit" name="mode" value="FULL" size="sm">
                              Відшкодувати борг
                            </Button>
                          </form>
                        )}
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
