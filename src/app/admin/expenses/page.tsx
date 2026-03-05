import { ExpenseCategory } from '@prisma/client'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { formatDate, formatUAH, toDateInputValue } from '@/lib/admin-finance'
import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    q?: string
    category?: string
    from?: string
    to?: string
    sort?: string
    dir?: string
  }>
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  ADS: 'Реклама',
  PACKAGING: 'Пакування',
  SHIPPING: 'Доставка',
  PAYMENT_FEES: 'Платіжні комісії',
  PAYROLL: 'Оплата роботи',
  PHOTO: 'Фото / контент',
  SOFTWARE: 'Сервіси / софт',
  RENT: 'Оренда',
  OTHER: 'Інше',
}

const ExpenseSchema = z.object({
  title: z.string().trim().min(2),
  category: z.nativeEnum(ExpenseCategory),
  amountUAH: z.coerce.number().int().min(0),
  expenseDate: z.coerce.date(),
  notes: z.string().trim().optional(),
})

type ExpenseSortKey = 'date' | 'amount' | 'title' | 'category'
type SortDirection = 'asc' | 'desc'

function getValidExpenseCategory(value?: string): ExpenseCategory | undefined {
  const categories = Object.keys(CATEGORY_LABELS) as ExpenseCategory[]
  return categories.includes(value as ExpenseCategory)
    ? (value as ExpenseCategory)
    : undefined
}

function getValidExpenseSortKey(value?: string): ExpenseSortKey {
  const allowed: ExpenseSortKey[] = ['date', 'amount', 'title', 'category']
  return allowed.includes(value as ExpenseSortKey) ? (value as ExpenseSortKey) : 'date'
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

export default async function AdminExpensesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const query = params.q?.trim() ?? ''
  const category = getValidExpenseCategory(params.category)
  const from = parseOptionalDate(params.from)
  const to = parseOptionalDate(params.to)
  const sort = getValidExpenseSortKey(params.sort)
  const dir = getValidSortDirection(params.dir, 'desc')
  const fromInputValue = from ? toDateInputValue(from) : ''
  const toInputValue = to ? toDateInputValue(to) : ''

  async function createExpense(formData: FormData) {
    'use server'

    const parsed = ExpenseSchema.safeParse({
      title: formData.get('title'),
      category: formData.get('category'),
      amountUAH: formData.get('amountUAH'),
      expenseDate: formData.get('expenseDate'),
      notes: formData.get('notes'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося створити витрату')
    }

    await prisma.expense.create({
      data: {
        title: parsed.data.title,
        category: parsed.data.category,
        amountUAH: parsed.data.amountUAH,
        expenseDate: parsed.data.expenseDate,
        notes: parsed.data.notes || null,
      },
    })

    revalidatePath('/admin/expenses')
    revalidatePath('/admin/finance')
  }

  async function deleteExpense(formData: FormData) {
    'use server'

    const id = String(formData.get('id') || '')
    if (!id) return

    await prisma.expense.delete({
      where: { id },
    })

    revalidatePath('/admin/expenses')
    revalidatePath('/admin/finance')
  }

  const expenses = await prisma.expense.findMany({
    where: {
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { notes: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(category ? { category } : {}),
      ...(from || to
        ? {
            expenseDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
  })

  const sortedExpenses = [...expenses].sort((a, b) => {
    const direction = dir === 'asc' ? 1 : -1

    switch (sort) {
      case 'amount':
        return direction * (a.amountUAH - b.amountUAH)
      case 'title':
        return direction * a.title.localeCompare(b.title, 'uk')
      case 'category':
        return direction * a.category.localeCompare(b.category, 'uk')
      case 'date':
      default:
        return (
          direction * (a.expenseDate.getTime() - b.expenseDate.getTime()) ||
          direction * (a.createdAt.getTime() - b.createdAt.getTime())
        )
    }
  })

  const totalExpenses = sortedExpenses.reduce(
    (sum, expense) => sum + expense.amountUAH,
    0,
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Витрати</h1>
        <p className="mt-1 text-sm text-gray-600">
          Операційні витрати для базового P&amp;L.
        </p>
      </div>

      <section className="rounded border bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-medium">Нова витрата</h2>
        <form action={createExpense} className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Назва
            <input
              name="title"
              required
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Категорія
            <select
              name="category"
              required
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              defaultValue={ExpenseCategory.OTHER}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Сума, грн
            <input
              name="amountUAH"
              type="number"
              min="0"
              required
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Дата
            <input
              name="expenseDate"
              type="date"
              defaultValue={toDateInputValue(new Date())}
              required
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
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
              Додати витрату
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded border bg-white">
        <div className="space-y-4 border-b p-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium">Журнал витрат</h2>
            <div className="text-sm text-gray-600">
              Разом: <span className="font-medium text-gray-900">{formatUAH(totalExpenses)}</span>
            </div>
          </div>

          <form method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <label className="text-sm font-medium xl:col-span-2">
              Пошук
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Назва або нотатки"
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm font-medium">
              Категорія
              <select
                name="category"
                defaultValue={category ?? ''}
                className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Усі</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
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
                <option value="amount">Сума</option>
                <option value="title">Назва</option>
                <option value="category">Категорія</option>
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
                href="/admin/expenses"
                className="inline-flex items-center justify-center rounded border px-4 py-2 text-sm"
              >
                Скинути
              </Link>
              <div className="text-sm text-gray-600">
                Записів: <span className="font-medium text-gray-900">{sortedExpenses.length}</span>
              </div>
            </div>
          </form>
        </div>

        {sortedExpenses.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">
            За поточними фільтрами витрат не знайдено.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Дата</th>
                  <th className="p-3 text-left">Категорія</th>
                  <th className="p-3 text-left">Назва</th>
                  <th className="p-3 text-right">Сума</th>
                  <th className="p-3 text-right">Дії</th>
                </tr>
              </thead>
              <tbody>
                {sortedExpenses.map((expense) => (
                  <tr key={expense.id} className="border-t">
                    <td className="whitespace-nowrap p-3">
                      {formatDate(expense.expenseDate)}
                    </td>
                    <td className="p-3">{CATEGORY_LABELS[expense.category]}</td>
                    <td className="p-3">
                      <div className="font-medium">{expense.title}</div>
                      {expense.notes ? (
                        <div className="mt-1 text-xs text-gray-500">{expense.notes}</div>
                      ) : null}
                    </td>
                    <td className="p-3 text-right">{formatUAH(expense.amountUAH)}</td>
                    <td className="p-3 text-right">
                      <form action={deleteExpense}>
                        <input type="hidden" name="id" value={expense.id} />
                        <ConfirmSubmitButton
                          confirmMessage="Видалити цю витрату?"
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
    </div>
  )
}
