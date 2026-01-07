'use client'

import { useState } from 'react'
import type { Order, OrderStatus } from '@prisma/client'
import { useRouter } from 'next/navigation'

type Props = {
  orders: Order[]
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  FAILED: 'Не вдалося',
  PENDING: 'Очікує',
  PAID: 'Оплачено',
  CANCELLED: 'Скасовано',
  FULFILLED: 'Виконано',
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  FAILED: 'bg-red-50 border-red-300 text-red-700',
  PENDING: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  PAID: 'bg-green-50 border-green-300 text-green-800',
  CANCELLED: 'bg-red-50 border-red-300 text-red-700',
  FULFILLED: 'bg-gray-50 border-gray-300 text-gray-700',
}

function getNovaPoshtaAddress(o: Order): string {
  const a = o as any

  const cityName = a.npCityName || ''
  const warehouseName = a.npWarehouseName || ''

  const parts = [
    cityName && String(cityName).trim(),
    warehouseName && `Відділення: ${String(warehouseName).trim()}`,
  ].filter(Boolean)

  return parts.length ? parts.join(', ') : '—'
}

type NormalizedOrderItem = {
  name: string
  qty: number
  image?: string | null
  color?: string | null
  strapName?: string | null
  addonsText?: string
}

function getOrderItems(o: Order): NormalizedOrderItem[] {
  const a = o as any

  let items: any[] | null = null

  if (Array.isArray(a.items)) items = a.items
  else if (Array.isArray(a.orderItems)) items = a.orderItems
  else if (typeof a.itemsJson === 'string') {
    try {
      const parsed = JSON.parse(a.itemsJson)
      if (Array.isArray(parsed)) items = parsed
    } catch {
      // ignore
    }
  } else if (typeof a.items === 'string') {
    try {
      const parsed = JSON.parse(a.items)
      if (Array.isArray(parsed)) items = parsed
    } catch {
      // ignore
    }
  }

  if (!items || !items.length) return []

  return items.map((it) => {
    const name = it.name || it.productName || it.title || 'Товар'
    const qty = typeof it.qty === 'number' ? it.qty : 1

    const strap = it.strapName || it.strap || null

    const addonsArr = Array.isArray(it.addons)
      ? it.addons
      : Array.isArray(it.addonVariants)
      ? it.addonVariants
      : Array.isArray(it.addonsOnVariant)
      ? it.addonsOnVariant
      : null

    const addonsText = addonsArr
      ? addonsArr
          .map((x: any) => x?.name || x?.addon?.name || x)
          .filter(Boolean)
          .join(', ')
      : ''

    return {
      name,
      qty,
      image: it.image ?? it.imageUrl ?? it.mainImageUrl ?? null,
      color: it.color ?? null,
      strapName: strap,
      addonsText,
    }
  })
}

export default function OrdersTableClient({ orders }: Props) {
  const router = useRouter()
  const [savingId, setSavingId] = useState<string | null>(null)

  const onStatusChange = async (id: string, status: OrderStatus) => {
    setSavingId(id)
    try {
      const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        console.error(await res.json())
        return
      }
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="border rounded bg-white">
      {/* Mobile cards */}
      <div className="md:hidden divide-y">
        {orders.map((o) => {
          const items = getOrderItems(o)
          return (
            <div key={o.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">
                    #{o.shortNumber ?? o.id.slice(0, 8)}
                  </div>
                  <div className="font-medium">
                    {o.customerSurname} {o.customerName}
                  </div>
                  <div className="text-sm text-gray-700">{o.customerPhone}</div>
                </div>

                <select
                  className={`border rounded px-2 py-1 text-xs cursor-pointer shrink-0 ${
                    STATUS_STYLES[o.status]
                  }`}
                  value={o.status}
                  onChange={(e) =>
                    onStatusChange(o.id, e.target.value as OrderStatus)
                  }
                  disabled={savingId === o.id}
                >
                  {(
                    Object.keys(STATUS_LABELS) as Array<
                      keyof typeof STATUS_LABELS
                    >
                  ).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 text-sm">
                <div className="text-xs text-gray-500">Адреса НП</div>
                <div className="text-gray-800 wrap-break-word">
                  {getNovaPoshtaAddress(o)}
                </div>
              </div>

              <div className="mt-3 text-sm">
                <div className="text-xs text-gray-500">Замовлення</div>
                {items.length ? (
                  <div className="mt-1 flex flex-col gap-2">
                    {items.map((it, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="relative w-12 h-12 rounded border bg-gray-50 overflow-hidden shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {it.image ? (
                            <img
                              src={it.image}
                              alt={it.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-start gap-2">
                            <div className="font-medium leading-snug truncate">
                              {it.name}
                            </div>
                            <span className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs whitespace-nowrap">
                              ×{it.qty}
                            </span>
                          </div>

                          {(it.color || it.strapName || it.addonsText) && (
                            <div className="mt-0.5 text-xs text-gray-600 leading-snug">
                              {it.color ? <div>Колір: {it.color}</div> : null}
                              {it.strapName ? (
                                <div>Ремінець: {it.strapName}</div>
                              ) : null}
                              {it.addonsText ? (
                                <div>Додатково: {it.addonsText}</div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-600">—</div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <div>
                  <div className="text-xs text-gray-500">Сума</div>
                  <div className="font-medium">{o.totalUAH} ₴</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Дата</div>
                  <div>{o.createdAt.toISOString().slice(0, 10)}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Клієнт</th>
              <th className="p-2 text-left">Телефон</th>
              <th className="p-2 text-left">Адреса НП</th>
              <th className="p-2 text-left">Замовлення</th>
              <th className="p-2 text-right">Сума</th>
              <th className="p-2 text-left">Статус</th>
              <th className="p-2 text-left">Дата</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-2">{o.id.slice(0, 8)}…</td>
                <td className="p-2">
                  {o.customerSurname} {o.customerName}
                </td>
                <td className="p-2">{o.customerPhone}</td>
                <td className="p-2 max-w-[280px] whitespace-normal wrap-break-word">
                  {getNovaPoshtaAddress(o)}
                </td>
                <td className="p-2 max-w-[520px] whitespace-normal wrap-break-word">
                  {(() => {
                    const items = getOrderItems(o)
                    if (!items.length) return '—'
                    return (
                      <div className="flex flex-col gap-2">
                        {items.map((it, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="relative w-12 h-12 rounded border bg-gray-50 overflow-hidden shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              {it.image ? (
                                <img
                                  src={it.image}
                                  alt={it.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-start gap-2">
                                <div className="font-medium leading-snug truncate">
                                  {it.name}
                                </div>
                                <span className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs whitespace-nowrap">
                                  ×{it.qty}
                                </span>
                              </div>

                              {(it.color || it.strapName || it.addonsText) && (
                                <div className="mt-0.5 text-xs text-gray-600 leading-snug">
                                  {it.color ? (
                                    <div>Колір: {it.color}</div>
                                  ) : null}
                                  {it.strapName ? (
                                    <div>Ремінець: {it.strapName}</div>
                                  ) : null}
                                  {it.addonsText ? (
                                    <div>Додатково: {it.addonsText}</div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </td>
                <td className="p-2 text-right">{o.totalUAH} ₴</td>
                <td className="p-2">
                  <select
                    className={`border rounded px-2 py-1 text-xs cursor-pointer ${
                      STATUS_STYLES[o.status]
                    }`}
                    value={o.status}
                    onChange={(e) =>
                      onStatusChange(o.id, e.target.value as OrderStatus)
                    }
                    disabled={savingId === o.id}
                  >
                    {(
                      Object.keys(STATUS_LABELS) as Array<
                        keyof typeof STATUS_LABELS
                      >
                    ).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  {o.createdAt.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
