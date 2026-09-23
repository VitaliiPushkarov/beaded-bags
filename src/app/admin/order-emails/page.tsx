import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  ADMIN_AUTH_COOKIE_NAME,
  verifyAdminSessionToken,
} from '@/lib/admin-auth'
import { getOrderEmailSettings } from '@/lib/order-email-settings'
import {
  areOrderEmailsEnabled,
  readOrderSmtpConfig,
} from '@/lib/order-email-config'
import { ORDER_EMAIL_ADDRESS } from '@/lib/order-email-copy'
import OrderEmailForm from './OrderEmailForm'

export const dynamic = 'force-dynamic'

export default async function OrderEmailsPage() {
  if (
    !(await verifyAdminSessionToken(
      (await cookies()).get(ADMIN_AUTH_COOKIE_NAME)?.value,
    ))
  ) {
    redirect('/admin/login')
  }
  const initial = await getOrderEmailSettings()
  const smtp = readOrderSmtpConfig()
  const ready = areOrderEmailsEnabled() && Boolean(smtp)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Листи клієнтам</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Лист надсилається автоматично після підтвердження оплати. Для
          банківського переказу клієнт спочатку отримує підтвердження оформлення
          з реквізитами, а після оплати — підтвердження оплати. Тут можна
          змінити текст наступних листів.
        </p>
      </div>
      <div
        className={`rounded-lg border p-4 text-sm ${ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}
      >
        <p className="font-medium">
          {ready
            ? 'Автоматичне надсилання налаштовано'
            : 'Надсилання ще не активне'}
        </p>
        <p className="mt-1">
          Відправник: {smtp?.from ?? `GERDAN <${ORDER_EMAIL_ADDRESS}>`}
        </p>
        {!ready && (
          <p className="mt-1">
            Для запуску потрібно завершити підключення пошти на сервері.
          </p>
        )}
        {ready && !process.env.CRON_SECRET?.trim() && (
          <p className="mt-1">
            Автоматичні повторні спроби потребують підключення планувальника на
            сервері.
          </p>
        )}
      </div>
      <OrderEmailForm initial={initial} />
    </div>
  )
}
