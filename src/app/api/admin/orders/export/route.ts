import { NextRequest, NextResponse } from 'next/server'

import { requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  FAILED: 'Не вдалося',
  PENDING: 'Очікує',
  PAID: 'Оплачено',
  CANCELLED: 'Скасовано',
  FULFILLED: 'Виконано',
}

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value)
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  const from = parseDate(req.nextUrl.searchParams.get('from'))
  const to = parseDate(req.nextUrl.searchParams.get('to'))

  const orders = await prisma.order.findMany({
    where:
      from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      shortNumber: true,
      createdAt: true,
      status: true,
      paymentMethod: true,
      customerName: true,
      customerSurname: true,
      customerPhone: true,
      subtotalUAH: true,
      discountUAH: true,
      totalUAH: true,
      itemsCostUAH: true,
      paymentFeeUAH: true,
      grossProfitUAH: true,
    },
  })

  const header = [
    'Номер',
    'Дата',
    'Статус',
    'Оплата',
    'Клієнт',
    'Телефон',
    'Проміжна сума',
    'Знижка',
    'Разом',
    'Собівартість',
    'Комісія',
    'Валовий прибуток',
  ]

  const rows = orders.map((order) =>
    [
      order.shortNumber,
      order.createdAt.toISOString().slice(0, 10),
      STATUS_LABELS[order.status] ?? order.status,
      order.paymentMethod,
      `${order.customerSurname} ${order.customerName}`.trim(),
      order.customerPhone,
      order.subtotalUAH,
      order.discountUAH,
      order.totalUAH,
      order.itemsCostUAH,
      order.paymentFeeUAH,
      order.grossProfitUAH,
    ]
      .map(csvCell)
      .join(','),
  )

  // BOM so Excel opens the Cyrillic text as UTF-8.
  const csv = '﻿' + [header.map(csvCell).join(','), ...rows].join('\r\n')
  const stamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${stamp}.csv"`,
    },
  })
}
