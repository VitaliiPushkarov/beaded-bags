'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ProductStatus } from '@prisma/client'

type Props = {
  productId: string
  initialStatus: ProductStatus
}

const STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: 'Чернетка',
  PUBLISHED: 'Опубліковано',
  ARCHIVED: 'Архів',
}

const STATUS_STYLES: Record<ProductStatus, string> = {
  DRAFT: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  PUBLISHED: 'bg-green-50 border-green-300 text-green-800',
  ARCHIVED: 'bg-gray-100 border-gray-300 text-gray-700',
}

export default function ProductStatusSelect({ productId, initialStatus }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<ProductStatus>(initialStatus)
  const [isPending, startTransition] = useTransition()

  const onChange = (nextStatus: ProductStatus) => {
    if (nextStatus === status) return

    const prev = status
    setStatus(nextStatus)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/products/${productId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        })

        if (!res.ok) {
          setStatus(prev)
          return
        }

        router.refresh()
      } catch {
        setStatus(prev)
      }
    })
  }

  return (
    <select
      value={status}
      onChange={(event) => onChange(event.target.value as ProductStatus)}
      disabled={isPending}
      className={`cursor-pointer rounded border px-2 py-1 text-xs ${STATUS_STYLES[status]}`}
      aria-label="Статус товару"
    >
      {(Object.keys(STATUS_LABELS) as ProductStatus[]).map((value) => (
        <option key={value} value={value}>
          {STATUS_LABELS[value]}
        </option>
      ))}
    </select>
  )
}
