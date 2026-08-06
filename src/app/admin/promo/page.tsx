import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { normalizePromoCode } from '@/lib/promo-rules'

export const dynamic = 'force-dynamic'

const PromoFormSchema = z.object({
  id: z.string().trim().optional(),
  code: z.string().trim().min(2).max(64),
  discountPercent: z.coerce.number().int().min(1).max(100),
  isActive: z.coerce.boolean(),
  showAfterOrder: z.coerce.boolean(),
  minOrderUAH: z.coerce.number().int().min(0),
  usageLimit: z.preprocess(
    (value) => (value === '' || value == null ? null : Number(value)),
    z.number().int().min(1).nullable(),
  ),
  startsAt: z.string().trim().optional(),
  endsAt: z.string().trim().optional(),
  note: z.string().trim().max(300).optional(),
})

function parseDate(value: string | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toDateInputValue(value: Date | null): string {
  if (!value) return ''
  return value.toISOString().slice(0, 10)
}

export default async function AdminPromoPage() {
  async function savePromoAction(formData: FormData) {
    'use server'

    const parsed = PromoFormSchema.safeParse({
      id: formData.get('id') ?? undefined,
      code: formData.get('code'),
      discountPercent: formData.get('discountPercent'),
      isActive: formData.get('isActive') === 'on',
      showAfterOrder: formData.get('showAfterOrder') === 'on',
      minOrderUAH: formData.get('minOrderUAH') || 0,
      usageLimit: formData.get('usageLimit'),
      startsAt: formData.get('startsAt') ?? undefined,
      endsAt: formData.get('endsAt') ?? undefined,
      note: formData.get('note') ?? undefined,
    })

    if (!parsed.success) return

    const data = parsed.data
    const code = normalizePromoCode(data.code)

    const values = {
      code,
      discountPercent: data.discountPercent,
      isActive: data.isActive,
      showAfterOrder: data.showAfterOrder,
      minOrderUAH: data.minOrderUAH,
      usageLimit: data.usageLimit,
      startsAt: parseDate(data.startsAt),
      endsAt: parseDate(data.endsAt),
      note: data.note || null,
    }

    // Only one code is offered after checkout — turn the flag off elsewhere so
    // the success page never has to guess between two.
    if (values.showAfterOrder) {
      await prisma.promoCode.updateMany({
        where: data.id ? { NOT: { id: data.id } } : {},
        data: { showAfterOrder: false },
      })
    }

    if (data.id) {
      await prisma.promoCode.update({ where: { id: data.id }, data: values })
    } else {
      await prisma.promoCode.create({ data: values })
    }

    revalidatePath('/admin/promo')
  }

  async function deletePromoAction(formData: FormData) {
    'use server'
    const id = String(formData.get('id') ?? '').trim()
    if (!id) return

    await prisma.promoCode.delete({ where: { id } })
    revalidatePath('/admin/promo')
  }

  const promos = await prisma.promoCode.findMany({
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
  })

  const inputClass =
    'mt-1 w-full border rounded px-3 py-2 text-sm border-slate-300'
  const labelClass = 'block text-xs font-medium text-slate-600'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Промокоди</h1>
        <p className="mt-1 text-sm text-slate-600">
          Знижка рахується від суми товарів і перевіряється на сервері під час
          створення замовлення. Код із позначкою «Показувати після замовлення»
          зʼявляється покупцю на сторінці успішного оформлення.
        </p>
      </div>

      <form
        action={savePromoAction}
        className="grid gap-4 rounded border border-slate-200 bg-white p-5 md:grid-cols-3"
      >
        <div className="md:col-span-3 text-sm font-medium">Новий промокод</div>

        <label className={labelClass}>
          Код
          <input name="code" required placeholder="SPECIAL" className={inputClass} />
        </label>
        <label className={labelClass}>
          Знижка, %
          <input
            name="discountPercent"
            type="number"
            min={1}
            max={100}
            defaultValue={10}
            required
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Мінімальна сума, ₴
          <input
            name="minOrderUAH"
            type="number"
            min={0}
            defaultValue={0}
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Ліміт використань (порожньо — без ліміту)
          <input name="usageLimit" type="number" min={1} className={inputClass} />
        </label>
        <label className={labelClass}>
          Діє з
          <input name="startsAt" type="date" className={inputClass} />
        </label>
        <label className={labelClass}>
          Діє до
          <input name="endsAt" type="date" className={inputClass} />
        </label>

        <label className="md:col-span-3 block text-xs font-medium text-slate-600">
          Нотатка (для себе)
          <input name="note" className={inputClass} placeholder="Instagram, серпень" />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked />
          Активний
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showAfterOrder" />
          Показувати після замовлення
        </label>

        <div className="md:col-span-3">
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm text-white"
          >
            Додати промокод
          </button>
        </div>
      </form>

      <div className="space-y-4">
        {promos.length === 0 && (
          <p className="text-sm text-slate-500">Промокодів ще немає.</p>
        )}

        {promos.map((promo) => (
          <form
            key={promo.id}
            action={savePromoAction}
            className="grid gap-4 rounded border border-slate-200 bg-white p-5 md:grid-cols-3"
          >
            <input type="hidden" name="id" value={promo.id} />

            <div className="md:col-span-3 flex flex-wrap items-center gap-3">
              <span className="text-base font-semibold tracking-wide">
                {promo.code}
              </span>
              <span
                className={`rounded border px-2 py-0.5 text-xs ${
                  promo.isActive
                    ? 'border-green-300 bg-green-50 text-green-800'
                    : 'border-slate-300 bg-slate-50 text-slate-600'
                }`}
              >
                {promo.isActive ? 'Активний' : 'Вимкнений'}
              </span>
              {promo.showAfterOrder && (
                <span className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs text-blue-800">
                  Показується після замовлення
                </span>
              )}
              <span className="text-xs text-slate-500">
                Використано: {promo.usedCount}
                {promo.usageLimit ? ` / ${promo.usageLimit}` : ''}
              </span>
            </div>

            <label className={labelClass}>
              Код
              <input
                name="code"
                defaultValue={promo.code}
                required
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Знижка, %
              <input
                name="discountPercent"
                type="number"
                min={1}
                max={100}
                defaultValue={promo.discountPercent}
                required
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Мінімальна сума, ₴
              <input
                name="minOrderUAH"
                type="number"
                min={0}
                defaultValue={promo.minOrderUAH}
                className={inputClass}
              />
            </label>

            <label className={labelClass}>
              Ліміт використань
              <input
                name="usageLimit"
                type="number"
                min={1}
                defaultValue={promo.usageLimit ?? ''}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Діє з
              <input
                name="startsAt"
                type="date"
                defaultValue={toDateInputValue(promo.startsAt)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Діє до
              <input
                name="endsAt"
                type="date"
                defaultValue={toDateInputValue(promo.endsAt)}
                className={inputClass}
              />
            </label>

            <label className="md:col-span-3 block text-xs font-medium text-slate-600">
              Нотатка
              <input
                name="note"
                defaultValue={promo.note ?? ''}
                className={inputClass}
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={promo.isActive}
              />
              Активний
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="showAfterOrder"
                defaultChecked={promo.showAfterOrder}
              />
              Показувати після замовлення
            </label>

            <div className="md:col-span-3 flex gap-3">
              <button
                type="submit"
                className="rounded bg-black px-4 py-2 text-sm text-white"
              >
                Зберегти
              </button>
              <button
                type="submit"
                formAction={deletePromoAction}
                className="rounded border border-rose-300 px-4 py-2 text-sm text-rose-700"
              >
                Видалити
              </button>
            </div>
          </form>
        ))}
      </div>
    </div>
  )
}
