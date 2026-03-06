import { PurchaseStatus } from '@prisma/client'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { formatDate, formatUAH, toDateInputValue } from '@/lib/admin-finance'
import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'
import { ensureChinaMarketplaceSupplier } from '@/lib/management-accounting'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    q?: string
    status?: string
    from?: string
    to?: string
    sort?: string
    dir?: string
  }>
}

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  DRAFT: 'Чернетка',
  ORDERED: 'Замовлено',
  RECEIVED: 'Отримано',
  PAID: 'Оплачено',
  CANCELLED: 'Скасовано',
}

const PurchaseSchema = z.object({
  status: z.nativeEnum(PurchaseStatus),
  purchasedAt: z.coerce.date(),
  invoiceNumber: z.string().trim().optional(),
  deliveryUAH: z.coerce.number().int().min(0).optional().default(0),
  notes: z.string().trim().optional(),
  itemsRaw: z.string().trim().min(1),
})

type PurchaseSortKey = 'date' | 'total' | 'status'
type SortDirection = 'asc' | 'desc'

function parsePurchaseItems(input: string) {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split(';').map((part) => part.trim())
      if (parts.length < 4) {
        throw new Error(
          `Рядок ${index + 1} має бути у форматі: назва; кількість; од.; ціна`,
        )
      }

      const qty = Number(parts[1].replace(',', '.'))
      const unitPriceUAH = Number(parts[3].replace(/[^\d.-]/g, ''))

      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error(`Некоректна кількість у рядку ${index + 1}`)
      }

      if (!Number.isFinite(unitPriceUAH) || unitPriceUAH < 0) {
        throw new Error(`Некоректна ціна у рядку ${index + 1}`)
      }

      return {
        title: parts[0],
        qty,
        unit: parts[2] || 'pcs',
        unitPriceUAH: Math.round(unitPriceUAH),
        totalUAH: Math.round(qty * unitPriceUAH),
      }
    })
}

function getValidPurchaseStatus(value?: string): PurchaseStatus | undefined {
  const statuses = Object.keys(STATUS_LABELS) as PurchaseStatus[]
  return statuses.includes(value as PurchaseStatus) ? (value as PurchaseStatus) : undefined
}

function getValidPurchaseSortKey(value?: string): PurchaseSortKey {
  const allowed: PurchaseSortKey[] = ['date', 'total', 'status']
  return allowed.includes(value as PurchaseSortKey) ? (value as PurchaseSortKey) : 'date'
}

function getValidSortDirection(
  value: string | undefined,
  fallback: SortDirection,
): SortDirection {
  return value === 'asc' || value === 'desc' ? value : fallback
}

function parseOptionalDate(value?: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export default async function AdminPurchasesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const query = params.q?.trim() ?? ''
  const status = getValidPurchaseStatus(params.status)
  const from = parseOptionalDate(params.from)
  const to = parseOptionalDate(params.to)
  const sort = getValidPurchaseSortKey(params.sort)
  const dir = getValidSortDirection(params.dir, 'desc')
  const fromInputValue = from ? toDateInputValue(from) : ''
  const toInputValue = to ? toDateInputValue(to) : ''

  async function createPurchase(formData: FormData) {
    'use server'

    const parsed = PurchaseSchema.safeParse({
      status: formData.get('status'),
      purchasedAt: formData.get('purchasedAt'),
      invoiceNumber: formData.get('invoiceNumber'),
      deliveryUAH: formData.get('deliveryUAH'),
      notes: formData.get('notes'),
      itemsRaw: formData.get('itemsRaw'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося створити закупівлю')
    }

    const items = parsePurchaseItems(parsed.data.itemsRaw)
    const subtotalUAH = items.reduce((sum, item) => sum + item.totalUAH, 0)
    const deliveryUAH = parsed.data.deliveryUAH ?? 0
    const supplier = await ensureChinaMarketplaceSupplier(prisma)

    await prisma.purchase.create({
      data: {
        supplierId: supplier.id,
        status: parsed.data.status,
        purchasedAt: parsed.data.purchasedAt,
        invoiceNumber: parsed.data.invoiceNumber || null,
        deliveryUAH,
        subtotalUAH,
        totalUAH: subtotalUAH + deliveryUAH,
        notes: parsed.data.notes || null,
        items: {
          create: items,
        },
      },
    })

    revalidatePath('/admin/purchases')
    revalidatePath('/admin/finance')
  }

  async function deletePurchase(formData: FormData) {
    'use server'

    const id = String(formData.get('id') || '')
    if (!id) return

    await prisma.purchase.delete({
      where: { id },
    })

    revalidatePath('/admin/purchases')
    revalidatePath('/admin/finance')
  }

  const purchases = await prisma.purchase.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            purchasedAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { invoiceNumber: { contains: query, mode: 'insensitive' } },
              { notes: { contains: query, mode: 'insensitive' } },
              { items: { some: { title: { contains: query, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    },
    orderBy:
      sort === 'total'
        ? [{ totalUAH: dir }, { purchasedAt: 'desc' }, { createdAt: 'desc' }]
        : sort === 'status'
          ? [{ status: dir }, { purchasedAt: 'desc' }, { createdAt: 'desc' }]
          : [{ purchasedAt: dir }, { createdAt: 'desc' }],
    include: {
      supplier: true,
      items: true,
    },
  })

  const totalPurchasesUAH = purchases.reduce(
    (sum, purchase) => sum + purchase.totalUAH,
    0,
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Закупівлі</h1>
        <p className="mt-1 text-sm text-gray-600">
          Простий реєстр закупівель для матеріалів із авто-постачальником China Marketplace.
        </p>
      </div>

      <section className="rounded border bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-medium">Нова закупівля</h2>
        <form action={createPurchase} className="grid gap-4 sm:grid-cols-2">
          <div className="rounded border border-dashed bg-gray-50 px-3 py-2 text-sm text-gray-700 sm:col-span-2">
            Постачальник встановлюється автоматично: <span className="font-medium">China Marketplace</span>
          </div>

            <label className="block text-sm font-medium">
              Статус
              <select
                name="status"
                defaultValue={PurchaseStatus.RECEIVED}
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Дата
              <input
                name="purchasedAt"
                type="date"
                defaultValue={toDateInputValue(new Date())}
                required
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm font-medium">
              Номер накладної / рахунку
              <input
                name="invoiceNumber"
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm font-medium">
              Доставка, грн
              <input
                name="deliveryUAH"
                type="number"
                min="0"
                defaultValue="0"
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm font-medium sm:col-span-2">
              Позиції закупівлі
              <textarea
                name="itemsRaw"
                required
                className="mt-2 min-h-32 w-full rounded-lg border px-3 py-2 text-sm font-mono"
                placeholder={'Бісер Preciosa; 10; уп.; 85\nПакети zip; 50; шт.; 6'}
              />
              <div className="mt-2 text-xs text-gray-500">
                Формат кожного рядка: `назва; кількість; од.; ціна за одиницю`
              </div>
            </label>

            <label className="block text-sm font-medium sm:col-span-2">
              Нотатки
              <textarea
                name="notes"
                className="mt-2 min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>

            <div className="sm:col-span-2">
              <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
                Зберегти закупівлю
              </button>
            </div>
          </form>
      </section>

      <section className="overflow-hidden rounded border bg-white">
        <div className="space-y-4 border-b p-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium">Журнал закупівель</h2>
            <div className="text-sm text-gray-600">
              Разом: <span className="font-medium text-gray-900">{formatUAH(totalPurchasesUAH)}</span>
            </div>
          </div>

          <form method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <label className="text-sm font-medium xl:col-span-2">
              Пошук
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Документ, нотатка, позиція"
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm font-medium">
              Статус
              <select
                name="status"
                defaultValue={status ?? ''}
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Усі</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Від
              <input
                type="date"
                name="from"
                defaultValue={fromInputValue}
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm font-medium">
              До
              <input
                type="date"
                name="to"
                defaultValue={toInputValue}
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm font-medium">
              Сортувати
              <select
                name="sort"
                defaultValue={sort}
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="date">Дата</option>
                <option value="total">Сума</option>
                <option value="status">Статус</option>
              </select>
            </label>

            <label className="text-sm font-medium">
              Напрям
              <select
                name="dir"
                defaultValue={dir}
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="desc">За спаданням</option>
                <option value="asc">За зростанням</option>
              </select>
            </label>

            <div className="flex items-end gap-3 sm:col-span-2 xl:col-span-6">
              <button className="inline-flex items-center justify-center rounded bg-black px-4 py-2 text-sm text-white hover:bg-[#FF3D8C]">
                Застосувати
              </button>
              <Link
                href="/admin/purchases"
                className="inline-flex items-center justify-center rounded border px-4 py-2 text-sm"
              >
                Скинути
              </Link>
              <div className="text-sm text-gray-600">
                Записів: <span className="font-medium text-gray-900">{purchases.length}</span>
              </div>
            </div>
          </form>
        </div>

        {purchases.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">
            За поточними фільтрами закупівель не знайдено.
          </div>
        ) : (
          <div className="divide-y">
            {purchases.map((purchase) => (
              <div key={purchase.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-medium">
                      {purchase.supplier.name}
                      <span className="ml-2 text-sm text-gray-500">
                        {STATUS_LABELS[purchase.status]}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      {formatDate(purchase.purchasedAt)}
                      {purchase.invoiceNumber ? ` • Документ: ${purchase.invoiceNumber}` : ''}
                    </div>
                    {purchase.notes ? (
                      <div className="mt-1 text-sm text-gray-600">{purchase.notes}</div>
                    ) : null}
                  </div>

                  <div className="text-right text-sm">
                    <div className="font-medium">{formatUAH(purchase.totalUAH)}</div>
                    <div className="text-gray-500">
                      Товари: {formatUAH(purchase.subtotalUAH)}
                    </div>
                    <div className="text-gray-500">
                      Доставка: {formatUAH(purchase.deliveryUAH)}
                    </div>
                    <form action={deletePurchase} className="mt-2">
                      <input type="hidden" name="id" value={purchase.id} />
                      <ConfirmSubmitButton
                        confirmMessage="Видалити цю закупівлю?"
                        className="text-xs text-red-600 hover:underline"
                      >
                        Видалити закупівлю
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left">Позиція</th>
                        <th className="p-2 text-right">К-сть</th>
                        <th className="p-2 text-left">Од.</th>
                        <th className="p-2 text-right">Ціна</th>
                        <th className="p-2 text-right">Сума</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchase.items.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-2">{item.title}</td>
                          <td className="p-2 text-right">
                            {Number.isInteger(item.qty) ? item.qty : item.qty.toFixed(2)}
                          </td>
                          <td className="p-2">{item.unit}</td>
                          <td className="p-2 text-right">{formatUAH(item.unitPriceUAH)}</td>
                          <td className="p-2 text-right">{formatUAH(item.totalUAH)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
