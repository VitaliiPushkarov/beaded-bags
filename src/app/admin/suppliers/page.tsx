import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatUAH } from '@/lib/admin-finance'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const SupplierSchema = z.object({
  name: z.string().trim().min(2),
  contactName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  currency: z.string().trim().min(3).max(3).default('UAH'),
  notes: z.string().trim().optional(),
})

export default async function AdminSuppliersPage() {
  async function createSupplier(formData: FormData) {
    'use server'

    const parsed = SupplierSchema.safeParse({
      name: formData.get('name'),
      contactName: formData.get('contactName'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      currency: formData.get('currency'),
      notes: formData.get('notes'),
    })

    if (!parsed.success) {
      throw new Error('Не вдалося створити постачальника')
    }

    await prisma.supplier.create({
      data: {
        name: parsed.data.name,
        contactName: parsed.data.contactName || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        currency: parsed.data.currency.toUpperCase(),
        notes: parsed.data.notes || null,
      },
    })

    revalidatePath('/admin/suppliers')
    revalidatePath('/admin/finance')
  }

  async function deleteSupplier(formData: FormData) {
    'use server'

    const id = String(formData.get('id') || '')
    if (!id) return

    await prisma.$transaction(async (tx) => {
      await tx.purchase.deleteMany({
        where: { supplierId: id },
      })

      await tx.supplier.delete({
        where: { id },
      })
    })

    revalidatePath('/admin/suppliers')
    revalidatePath('/admin/finance')
  }

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: 'asc' },
    include: {
      purchases: {
        select: {
          totalUAH: true,
        },
      },
      _count: {
        select: {
          purchases: true,
        },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Постачальники</h1>
        <p className="mt-1 text-sm text-gray-600">
          Довідник постачальників для контролю закупівель.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Новий постачальник</CardTitle>
          <CardDescription>
            Збережи контакт, валюту і примітки по постачальнику.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createSupplier} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="supplier-name">Назва</Label>
              <Input id="supplier-name" name="name" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supplier-contact">Контактна особа</Label>
              <Input id="supplier-contact" name="contactName" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supplier-phone">Телефон</Label>
              <Input id="supplier-phone" name="phone" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supplier-email">Email</Label>
              <Input id="supplier-email" name="email" type="email" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supplier-currency">Валюта</Label>
              <Input
                id="supplier-currency"
                name="currency"
                defaultValue="UAH"
                maxLength={3}
                className="uppercase"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="supplier-notes">Нотатки</Label>
              <Textarea id="supplier-notes" name="notes" className="min-h-24" />
            </div>

            <div className="sm:col-span-2">
              <Button type="submit">Зберегти постачальника</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-200">
          <CardTitle>Список постачальників</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {suppliers.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">
              Ще немає жодного постачальника.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Назва</TableHead>
                  <TableHead>Контакт</TableHead>
                  <TableHead>Валюта</TableHead>
                  <TableHead className="text-right">Закупівель</TableHead>
                  <TableHead className="text-right">Сума закупівель</TableHead>
                  <TableHead className="text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => {
                  const totalSpent = supplier.purchases.reduce(
                    (sum, purchase) => sum + purchase.totalUAH,
                    0,
                  )

                  return (
                    <TableRow key={supplier.id}>
                      <TableCell>
                        <div className="font-medium">{supplier.name}</div>
                        {supplier.notes ? (
                          <div className="mt-1 text-xs text-gray-500">
                            {supplier.notes}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        <div>{supplier.contactName || '—'}</div>
                        <div className="text-xs text-gray-500">
                          {supplier.phone || supplier.email || '—'}
                        </div>
                      </TableCell>
                      <TableCell>{supplier.currency}</TableCell>
                      <TableCell className="text-right">
                        {supplier._count.purchases}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatUAH(totalSpent)}
                      </TableCell>
                      <TableCell className="text-right">
                        <form action={deleteSupplier}>
                          <input type="hidden" name="id" value={supplier.id} />
                          <ConfirmSubmitButton
                            confirmMessage={`Видалити постачальника "${supplier.name}" разом з усіма його закупівлями?`}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Видалити з закупівлями
                          </ConfirmSubmitButton>
                        </form>
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
