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
    <div className="overflow-x-auto border rounded bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">ID</th>
            <th className="p-2 text-left">Клієнт</th>
            <th className="p-2 text-left">Телефон</th>
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
              <td className="p-2 text-right">{o.totalUAH} ₴</td>
              <td className="p-2">
                <select
                  className="border rounded px-2 py-1 text-xs"
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
              <td className="p-2">{o.createdAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
