import { ExpenseCategory } from '@prisma/client'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'
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
import { formatDate, formatUAH, toDateInputValue } from '@/lib/admin-finance'
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

      <Card>
        <CardHeader>
          <CardTitle>Нова витрата</CardTitle>
          <CardDescription>Додай операційну витрату для обліку.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createExpense} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="expense-title">Назва</Label>
              <Input id="expense-title" name="title" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-category">Категорія</Label>
              <Select
                id="expense-category"
                name="category"
                required
                defaultValue={ExpenseCategory.OTHER}
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">Сума, грн</Label>
              <Input
                id="expense-amount"
                name="amountUAH"
                type="number"
                min="0"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-date">Дата</Label>
              <Input
                id="expense-date"
                name="expenseDate"
                type="date"
                defaultValue={toDateInputValue(new Date())}
                required
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="expense-notes">Нотатки</Label>
              <Textarea id="expense-notes" name="notes" className="min-h-24" />
            </div>

            <div className="sm:col-span-2">
              <Button type="submit">Додати витрату</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-200">
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Журнал витрат</CardTitle>
            <div className="text-sm text-gray-600">
              Разом:{' '}
              <span className="font-medium text-gray-900">
                {formatUAH(totalExpenses)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <form method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-1.5 xl:col-span-2">
              <Label htmlFor="expense-search">Пошук</Label>
              <Input
                id="expense-search"
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Назва або нотатки"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-filter-category">Категорія</Label>
              <Select
                id="expense-filter-category"
                name="category"
                defaultValue={category ?? ''}
              >
                <option value="">Усі</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-from">Від</Label>
              <Input
                id="expense-from"
                type="date"
                name="from"
                defaultValue={fromInputValue}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-to">До</Label>
              <Input
                id="expense-to"
                type="date"
                name="to"
                defaultValue={toInputValue}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-sort">Сортувати</Label>
              <Select id="expense-sort" name="sort" defaultValue={sort}>
                <option value="date">Дата</option>
                <option value="amount">Сума</option>
                <option value="title">Назва</option>
                <option value="category">Категорія</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-dir">Напрям</Label>
              <Select id="expense-dir" name="dir" defaultValue={dir}>
                <option value="desc">За спаданням</option>
                <option value="asc">За зростанням</option>
              </Select>
            </div>

            <div className="flex items-end gap-3 sm:col-span-2 xl:col-span-6">
              <Button type="submit">Застосувати</Button>
              <Link
                href="/admin/expenses"
                className={buttonVariants({ variant: 'outline' })}
              >
                Скинути
              </Link>
              <div className="text-sm text-gray-600">
                Записів:{' '}
                <span className="font-medium text-gray-900">
                  {sortedExpenses.length}
                </span>
              </div>
            </div>
          </form>

          {sortedExpenses.length === 0 ? (
            <div className="text-sm text-gray-600">
              За поточними фільтрами витрат не знайдено.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Дата</TableHead>
                  <TableHead>Категорія</TableHead>
                  <TableHead>Назва</TableHead>
                  <TableHead className="text-right">Сума</TableHead>
                  <TableHead className="text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(expense.expenseDate)}
                    </TableCell>
                    <TableCell>{CATEGORY_LABELS[expense.category]}</TableCell>
                    <TableCell>
                      <div className="font-medium">{expense.title}</div>
                      {expense.notes ? (
                        <div className="mt-1 text-xs text-gray-500">
                          {expense.notes}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatUAH(expense.amountUAH)}
                    </TableCell>
                    <TableCell className="text-right">
                      <form action={deleteExpense}>
                        <input type="hidden" name="id" value={expense.id} />
                        <ConfirmSubmitButton
                          confirmMessage="Видалити цю витрату?"
                          className="text-xs text-red-600 hover:underline"
                        >
                          Видалити
                        </ConfirmSubmitButton>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
