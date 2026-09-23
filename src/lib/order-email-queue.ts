import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import {
  areOrderEmailsEnabled,
  readOrderSmtpConfig,
} from './order-email-config'
import { deliverOrderEmail } from './order-email'
import type { OrderEmailKind } from './order-email-template'

const LEASE_MS = 5 * 60 * 1000

export async function enqueueOrderEmailTx(
  tx: Prisma.TransactionClient,
  order: { id: string; customerEmail: string | null },
  kind: OrderEmailKind,
): Promise<void> {
  if (!areOrderEmailsEnabled() || !order.customerEmail?.trim()) return
  // ON CONFLICT DO NOTHING also protects concurrent callbacks. The job and
  // business event commit together, so a process exit cannot lose the email.
  await tx.orderEmailDelivery.createMany({
    data: [{ orderId: order.id, kind }],
    skipDuplicates: true,
  })
}

export function orderEmailRetryAt(attempt: number, now = new Date()): Date {
  return new Date(
    now.getTime() +
      Math.min(
        6 * 60 * 60 * 1000,
        60_000 * 2 ** Math.min(20, Math.max(0, attempt - 1)),
      ),
  )
}

function dueWhere(now: Date): Prisma.OrderEmailDeliveryWhereInput {
  return {
    sentAt: null,
    skippedAt: null,
    nextAttemptAt: { lte: now },
    OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
  }
}

async function processDelivery(
  id: string,
): Promise<'sent' | 'skipped' | 'retry' | 'busy'> {
  const now = new Date()
  const lockToken = randomUUID()
  const claimed = await prisma.orderEmailDelivery.updateMany({
    where: { id, ...dueWhere(now) },
    data: {
      lockToken,
      lockedUntil: new Date(now.getTime() + LEASE_MS),
      attempts: { increment: 1 },
    },
  })
  if (!claimed.count) return 'busy'
  try {
    const delivery = await prisma.orderEmailDelivery.findUniqueOrThrow({
      where: { id },
      include: { order: { include: { items: true } } },
    })
    const { order, kind } = delivery
    const eligible =
      kind === 'PAID'
        ? order.status === 'PAID' || order.status === 'FULFILLED'
        : order.status === 'PENDING' && order.paymentMethod === 'BANK_TRANSFER'
    if (!order.customerEmail?.trim() || !eligible) {
      await prisma.orderEmailDelivery.updateMany({
        where: { id, lockToken },
        data: {
          skippedAt: new Date(),
          lockToken: null,
          lockedUntil: null,
          lastError: 'no_recipient_or_superseded',
        },
      })
      return 'skipped'
    }
    await deliverOrderEmail({ deliveryId: id, order, kind })
    await prisma.orderEmailDelivery.updateMany({
      where: { id, lockToken },
      data: {
        sentAt: new Date(),
        lockToken: null,
        lockedUntil: null,
        lastError: null,
      },
    })
    return 'sent'
  } catch (error) {
    // Store codes only, never SMTP credentials or customer content.
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String(error.code).slice(0, 80)
        : 'delivery_failed'
    console.error('Order email delivery failed', { deliveryId: id, code })
    const row = await prisma.orderEmailDelivery.findUnique({
      where: { id },
      select: { attempts: true },
    })
    await prisma.orderEmailDelivery.updateMany({
      where: { id, lockToken },
      data: {
        lockToken: null,
        lockedUntil: null,
        lastError: code,
        nextAttemptAt: orderEmailRetryAt(row?.attempts ?? 1),
      },
    })
    return 'retry'
  }
}

export async function processOrderEmailQueue(orderId?: string) {
  if (!areOrderEmailsEnabled()) return { processed: 0, reason: 'disabled' }
  if (!readOrderSmtpConfig())
    return { processed: 0, reason: 'smtp_not_configured' }
  const deliveries = await prisma.orderEmailDelivery.findMany({
    where: { ...dueWhere(new Date()), ...(orderId ? { orderId } : {}) },
    orderBy: { nextAttemptAt: 'asc' },
    take: 5,
    select: { id: true },
  })
  const results = await Promise.allSettled(
    deliveries.map(({ id }) => processDelivery(id)),
  )
  return {
    processed: results.length,
    sent: results.filter((r) => r.status === 'fulfilled' && r.value === 'sent')
      .length,
    failed: results.filter(
      (r) => r.status === 'rejected' || r.value === 'retry',
    ).length,
  }
}
