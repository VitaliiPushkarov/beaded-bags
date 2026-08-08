'use client'

import { useActionState } from 'react'

import type { FiscalAuditRow } from '@/lib/liqpay-fiscal-audit'

export type FiscalRecheckState =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

type Props = {
  rows: FiscalAuditRow[]
  recheckAction: (
    prev: FiscalRecheckState,
    formData: FormData,
  ) => Promise<FiscalRecheckState>
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

const STATE_LABEL = {
  success: { text: 'Чек створено', className: 'bg-emerald-100 text-emerald-800' },
  failure: { text: 'Чека немає', className: 'bg-rose-100 text-rose-800' },
  unknown: { text: 'Невідомо', className: 'bg-amber-100 text-amber-900' },
} as const

export default function LiqPayFiscalAudit({ rows, recheckAction }: Props) {
  const [state, formAction, pending] = useActionState<
    FiscalRecheckState,
    FormData
  >(recheckAction, { status: 'idle' })

  const missing = rows.filter((row) => row.state !== 'success')

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Фіскальні чеки (ПРРО)</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Оплачені картою замовлення за останні 60 днів. LiqPay інколи
            фіскалізує вже після того, як надіслав нам відповідь, тому статус
            нижче — це те, що ми бачили останнього разу. Натисніть «Перевірити
            зараз», щоб запитати LiqPay наново.
          </p>
        </div>
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded border border-slate-300 px-4 text-sm transition hover:border-black disabled:opacity-60 cursor-pointer"
          >
            {pending ? 'Перевіряємо…' : 'Перевірити зараз'}
          </button>
        </form>
      </div>

      {state.status === 'success' ? (
        <p className="mt-3 text-sm text-emerald-700" role="status">
          {state.message}
        </p>
      ) : null}
      {state.status === 'error' ? (
        <p className="mt-3 text-sm text-rose-600" role="alert">
          {state.message}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          Немає оплачених онлайн-замовлень за цей період.
        </p>
      ) : (
        <>
          {missing.length > 0 ? (
            <div
              className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              role="alert"
            >
              <p className="font-medium">
                Без фіскального чека: {missing.length} з {rows.length}
              </p>
              <p className="mt-1 text-amber-800">
                Найчастіша причина — ціна, яку списано, не збігається з ціною
                товару в каталозі ПРРО (знижка, промокод або застаріла ціна в
                каталозі). Оновіть каталог у кроках 1–2 вище.
              </p>
            </div>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-4 font-medium">Замовлення</th>
                  <th className="pb-2 pr-4 font-medium">Дата</th>
                  <th className="pb-2 pr-4 font-medium">Сума</th>
                  <th className="pb-2 pr-4 font-medium">Промокод</th>
                  <th className="pb-2 font-medium">Чек</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const label = STATE_LABEL[row.state]
                  return (
                    <tr
                      key={row.orderId}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2 pr-4 font-medium">#{row.shortNumber}</td>
                      <td className="py-2 pr-4 text-slate-600">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">{row.totalUAH} ₴</td>
                      <td className="py-2 pr-4 text-slate-600">
                        {row.promoCode ?? '—'}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-xs ${label.className}`}
                        >
                          {label.text}
                        </span>
                        {row.ticketUrl ? (
                          <a
                            href={row.ticketUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 text-xs underline hover:text-[#FF3D8C]"
                          >
                            чек
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
