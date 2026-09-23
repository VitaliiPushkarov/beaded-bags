'use client'

import { useState, type FormEvent } from 'react'
import {
  DEFAULT_ORDER_EMAIL_SETTINGS,
  OrderEmailSettingsSchema,
  type OrderEmailCopy,
  type OrderEmailSettings,
} from '@/lib/order-email-copy'
import {
  buildOrderEmail,
  type OrderEmailKind,
  type OrderEmailLocale,
  type OrderEmailOrder,
} from '@/lib/order-email-template'

const FIELDS: Array<{
  key: keyof OrderEmailCopy
  label: string
  max: number
  rows: number
}> = [
  { key: 'subject', label: 'Тема листа', max: 200, rows: 1 },
  { key: 'intro', label: 'Привітання та подяка', max: 3000, rows: 4 },
  { key: 'nextSteps', label: 'Що буде далі', max: 2000, rows: 3 },
  { key: 'footer', label: 'Підпис', max: 1000, rows: 3 },
]

const SAMPLE_ORDER: OrderEmailOrder = {
  shortNumber: 1042,
  customerName: 'Олена',
  customerSurname: 'Коваль',
  subtotalUAH: 4200,
  discountUAH: 420,
  deliveryUAH: 0,
  totalUAH: 3780,
  paymentMethod: 'LIQPAY',
  shippingMethod: 'NOVA_POSHTA',
  npCityName: 'Київ',
  npWarehouseName: 'Відділення №5',
  items: [{ name: 'Сумка GERDAN', color: 'чорний', priceUAH: 2100, qty: 2 }],
}

export default function OrderEmailForm({
  initial,
}: {
  initial: OrderEmailSettings
}) {
  const [settings, setSettings] = useState(initial)
  const [locale, setLocale] = useState<OrderEmailLocale>('uk')
  const [kind, setKind] = useState<OrderEmailKind>('PAID')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const copy = settings[locale][kind]
  const preview = buildOrderEmail({
    order: {
      ...SAMPLE_ORDER,
      paymentMethod: kind === 'AWAITING_PAYMENT' ? 'BANK_TRANSFER' : 'LIQPAY',
      ...(locale === 'en'
        ? {
            customerName: 'Olena',
            shippingMethod: 'INTERNATIONAL_ADDRESS',
            shippingCountryName: 'Poland',
            shippingCity: 'Warsaw',
            shippingPostalCode: '00-001',
            shippingAddressLine1: 'ul. Prosta 1',
            items: [
              { name: 'GERDAN bag', color: 'black', priceUAH: 2100, qty: 2 },
            ],
          }
        : {}),
    },
    kind,
    locale,
    copy,
    bankTransferDetails: settings[locale].bankTransferDetails,
    siteUrl:
      locale === 'uk' ? 'https://gerdan.online' : 'https://en.gerdan.online',
  })

  function change(next: OrderEmailSettings) {
    setSettings(next)
    setDirty(true)
    setSaved(false)
    setError('')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaved(false)
    const parsed = OrderEmailSettingsSchema.safeParse(settings)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setError(
        `${issue.path[0] === 'en' ? 'Англійський' : 'Український'} шаблон: ${issue.message}`,
      )
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/admin/order-email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const body = await response.json()
      if (!response.ok)
        throw new Error(body.error || 'Не вдалося зберегти шаблон.')
      setSettings(body.settings)
      setDirty(false)
      setSaved(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не вдалося зберегти шаблон.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <fieldset disabled={saving} className="space-y-4 disabled:opacity-70">
        <div className="flex flex-wrap gap-4">
          <label className="text-sm font-medium">
            Мова
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as OrderEmailLocale)}
              className="ml-3 rounded-md border border-slate-300 bg-white px-3 py-2"
            >
              <option value="uk">Українська</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Лист
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as OrderEmailKind)}
              className="ml-3 rounded-md border border-slate-300 bg-white px-3 py-2"
            >
              <option value="PAID">Оплату підтверджено</option>
              <option value="AWAITING_PAYMENT">
                Оформлено — очікуємо переказ
              </option>
            </select>
          </label>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
            <p className="text-sm text-slate-600">
              Номер, товари, ціни, оплата й доставка додаються автоматично. У
              тексті можна використати: <code>{'{{orderNumber}}'}</code> —
              номер, <code>{'{{customerName}}'}</code> — ім’я,{' '}
              <code>{'{{totalAmount}}'}</code> — сума.
            </p>
            {FIELDS.map(({ key, label, max, rows }) => (
              <label
                key={key}
                className="block text-sm font-medium text-slate-800"
              >
                {label}
                <textarea
                  rows={rows}
                  maxLength={max}
                  required
                  value={copy[key]}
                  onChange={(e) =>
                    change({
                      ...settings,
                      [locale]: {
                        ...settings[locale],
                        [kind]: { ...copy, [key]: e.target.value },
                      },
                    })
                  }
                  className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
                />
              </label>
            ))}
            {kind === 'AWAITING_PAYMENT' && (
              <label className="block text-sm font-medium text-slate-800">
                Реквізити для банківського переказу
                <textarea
                  rows={5}
                  maxLength={4000}
                  value={settings[locale].bankTransferDetails}
                  onChange={(e) =>
                    change({
                      ...settings,
                      [locale]: {
                        ...settings[locale],
                        bankTransferDetails: e.target.value,
                      },
                    })
                  }
                  placeholder="Отримувач, IBAN, банк…"
                  className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  Призначення платежу з номером замовлення додається
                  автоматично.
                </span>
              </label>
            )}
            <button
              type="button"
              onClick={() =>
                change({
                  ...settings,
                  [locale]: {
                    ...settings[locale],
                    [kind]: { ...DEFAULT_ORDER_EMAIL_SETTINGS[locale][kind] },
                  },
                })
              }
              className="text-sm text-slate-600 underline"
            >
              Відновити стандартний текст цього листа
            </button>
          </div>
          <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-4">
              <h2 className="font-semibold">Попередній перегляд</h2>
              <p className="mt-1 text-xs text-slate-500">
                Приклад із вигаданим замовленням
              </p>
              <p className="mt-3 break-words text-sm">
                Тема: {preview.subject}
              </p>
            </div>
            <iframe
              title="Попередній перегляд листа клієнту"
              sandbox=""
              srcDoc={preview.html}
              className="h-[850px] w-full border-0 bg-slate-50"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!dirty || saving}
            className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Зберігаємо…' : 'Зберегти шаблони'}
          </button>
          {dirty && (
            <span className="text-sm text-slate-500">Є незбережені зміни</span>
          )}
        </div>
      </fieldset>
      {saved && (
        <p role="status" className="text-sm text-emerald-700">
          Шаблони збережено. Нові листи використовуватимуть цей текст.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
    </form>
  )
}
