import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { formatUAH } from '@/lib/admin-finance'
import ConfirmSubmitButton from '@/components/admin/ConfirmSubmitButton'

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
        <p className="text-sm text-gray-600 mt-1">
          Довідник постачальників для контролю закупівель.
        </p>
      </div>

      <section className="border rounded bg-white p-4 sm:p-6">
        <h2 className="text-lg font-medium mb-4">Новий постачальник</h2>
        <form action={createSupplier} className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Назва
            <input
              name="name"
              required
              className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Контактна особа
            <input
              name="contactName"
              className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Телефон
            <input
              name="phone"
              className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Email
            <input
              name="email"
              type="email"
              className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm font-medium">
            Валюта
            <input
              name="currency"
              defaultValue="UAH"
              maxLength={3}
              className="mt-2 w-full border rounded-lg px-3 py-2 text-sm uppercase"
            />
          </label>

          <label className="block text-sm font-medium sm:col-span-2">
            Нотатки
            <textarea
              name="notes"
              className="mt-2 w-full border rounded-lg px-3 py-2 text-sm min-h-24"
            />
          </label>

          <div className="sm:col-span-2">
            <button className="inline-flex items-center justify-center rounded bg-black text-white px-4 py-2 text-sm hover:bg-[#FF3D8C]">
              Зберегти постачальника
            </button>
          </div>
        </form>
      </section>

      <section className="border rounded bg-white overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-medium">Список постачальників</h2>
        </div>

        {suppliers.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">
            Ще немає жодного постачальника.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">Назва</th>
                  <th className="p-3 text-left">Контакт</th>
                  <th className="p-3 text-left">Валюта</th>
                  <th className="p-3 text-right">Закупівель</th>
                  <th className="p-3 text-right">Сума закупівель</th>
                  <th className="p-3 text-right">Дії</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => {
                  const totalSpent = supplier.purchases.reduce(
                    (sum, purchase) => sum + purchase.totalUAH,
                    0,
                  )

                  return (
                    <tr key={supplier.id} className="border-t">
                      <td className="p-3">
                        <div className="font-medium">{supplier.name}</div>
                        {supplier.notes ? (
                          <div className="text-xs text-gray-500 mt-1">
                            {supplier.notes}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-3 text-gray-700">
                        <div>{supplier.contactName || '—'}</div>
                        <div className="text-xs text-gray-500">
                          {supplier.phone || supplier.email || '—'}
                        </div>
                      </td>
                      <td className="p-3">{supplier.currency}</td>
                      <td className="p-3 text-right">
                        {supplier._count.purchases}
                      </td>
                      <td className="p-3 text-right">{formatUAH(totalSpent)}</td>
                      <td className="p-3 text-right">
                        <form action={deleteSupplier}>
                          <input type="hidden" name="id" value={supplier.id} />
                          <ConfirmSubmitButton
                            confirmMessage={`Видалити постачальника "${supplier.name}" разом з усіма його закупівлями?`}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Видалити з закупівлями
                          </ConfirmSubmitButton>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
