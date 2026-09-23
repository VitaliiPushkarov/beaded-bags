import test, { beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import nodemailer from 'nodemailer'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { DEFAULT_ORDER_EMAIL_SETTINGS } from './order-email-copy'
import {
  enqueueOrderEmailTx,
  orderEmailRetryAt,
  processOrderEmailQueue,
} from './order-email-queue'

// Only SMTP and database boundaries are mocked. Rendering, settings reads,
// dispatch decisions, claiming, retries and message construction run together.
const originalEnv = { ...process.env }
let sent: nodemailer.SendMailOptions[] = []
let failSmtp = false
let row = makeRow()
const restoreMethods: Array<() => void> = []
function mockPrismaMethod<T extends object, K extends keyof T>(
  target: T,
  key: K,
  implementation: unknown,
) {
  const original = target[key]
  target[key] = implementation as T[K]
  restoreMethods.push(() => {
    target[key] = original
  })
}

function makeRow() {
  return {
    id: 'delivery-1',
    orderId: 'order-1',
    kind: 'PAID' as 'PAID' | 'AWAITING_PAYMENT',
    attempts: 0,
    nextAttemptAt: new Date(0),
    lockedUntil: null as Date | null,
    lockToken: null as string | null,
    sentAt: null as Date | null,
    skippedAt: null as Date | null,
    lastError: null as string | null,
    order: {
      id: 'order-1',
      status: 'PAID',
      customerEmail: 'customer@example.com' as string | null,
      shortNumber: 1042,
      customerName: 'Олена',
      customerSurname: 'Коваль',
      paymentMethod: 'LIQPAY',
      shippingMethod: 'NOVA_POSHTA',
      npCityName: 'Київ',
      npWarehouseName: 'Відділення 5',
      subtotalUAH: 2100,
      totalUAH: 2100,
      deliveryUAH: 0,
      discountUAH: 0,
      items: [{ name: 'Сумка', qty: 1, priceUAH: 2100 }],
    },
  }
}

function isDue() {
  return (
    !row.sentAt &&
    !row.skippedAt &&
    row.nextAttemptAt <= new Date() &&
    (!row.lockedUntil || row.lockedUntil <= new Date())
  )
}

beforeEach(() => {
  process.env.ORDER_EMAILS_ENABLED = 'true'
  process.env.SMTP_PASSWORD = 'test-password'
  for (const key of [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_SECURE',
    'MAIL_FROM',
    'MAIL_REPLY_TO',
  ])
    delete process.env[key]
  sent = []
  failSmtp = false
  row = makeRow()
  mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async (message: nodemailer.SendMailOptions) => {
      if (failSmtp)
        throw Object.assign(new Error('SMTP unavailable'), {
          code: 'ECONNECTION',
        })
      sent.push(message)
      return { accepted: [message.to] }
    },
  }))
  mockPrismaMethod(prisma.orderEmailSettings, 'findUnique', async () => ({
    templates: DEFAULT_ORDER_EMAIL_SETTINGS,
  }))
  mockPrismaMethod(
    prisma.orderEmailDelivery,
    'findMany',
    async (args: { where: Prisma.OrderEmailDeliveryWhereInput }) => {
      assert.equal(args.where.sentAt, null)
      assert.equal(args.where.skippedAt, null)
      assert.ok(args.where.nextAttemptAt)
      assert.ok(args.where.OR)
      return isDue() ? [{ id: row.id }] : []
    },
  )
  mockPrismaMethod(
    prisma.orderEmailDelivery,
    'findUniqueOrThrow',
    async () => row,
  )
  mockPrismaMethod(prisma.orderEmailDelivery, 'findUnique', async () => row)
  mockPrismaMethod(
    prisma.orderEmailDelivery,
    'updateMany',
    async (args: {
      where: Prisma.OrderEmailDeliveryWhereInput
      data: Prisma.OrderEmailDeliveryUpdateManyMutationInput
    }) => {
      if (args.where.sentAt === null) {
        if (!isDue()) return { count: 0 }
        assert.equal(args.where.skippedAt, null)
        assert.ok(args.where.nextAttemptAt)
        assert.ok(args.where.OR)
        row.attempts += 1
        row.lockedUntil = args.data.lockedUntil as Date
        row.lockToken = args.data.lockToken as string
        return { count: 1 }
      }
      if (args.where.lockToken !== row.lockToken) return { count: 0 }
      Object.assign(row, args.data)
      return { count: 1 }
    },
  )
})

afterEach(() => {
  restoreMethods.reverse().forEach((restore) => restore())
  restoreMethods.length = 0
  mock.restoreAll()
  process.env = { ...originalEnv }
})

test('a paid order is sent from the studio with the full confirmation and is not sent again', async () => {
  const result = await processOrderEmailQueue(row.orderId)
  assert.equal(result.sent, 1)
  assert.ok(row.sentAt)
  assert.equal(row.attempts, 1)
  assert.equal(row.lockToken, null)
  assert.equal(sent[0].to, 'customer@example.com')
  assert.equal(sent[0].from, 'GERDAN <gerdanstudio@gmail.com>')
  assert.equal(sent[0].replyTo, 'gerdanstudio@gmail.com')
  assert.equal(sent[0].messageId, '<order-delivery-1@gerdan.online>')
  assert.match(String(sent[0].subject), /#1042/)
  assert.match(String(sent[0].text), /Сумка/)
  assert.match(String(sent[0].text), /2 100 ₴/)
  assert.match(String(sent[0].text), /LiqPay/)
  assert.match(String(sent[0].text), /Нова пошта/)
  await processOrderEmailQueue(row.orderId)
  assert.equal(sent.length, 1)
})

test('two concurrent workers can claim the same delivery only once', async () => {
  await Promise.all([processOrderEmailQueue(), processOrderEmailQueue()])
  assert.equal(sent.length, 1)
  assert.equal(row.attempts, 1)
})

test('an SMTP failure is persisted for retry; a later successful attempt completes it', async () => {
  failSmtp = true
  const before = Date.now()
  const result = await processOrderEmailQueue()
  assert.equal(result.failed, 1)
  assert.equal(row.sentAt, null)
  assert.equal(row.lastError, 'ECONNECTION')
  assert.equal(row.lockedUntil, null)
  assert.ok(row.nextAttemptAt.getTime() >= before + 60_000)
  await processOrderEmailQueue()
  assert.equal(row.attempts, 1)
  row.nextAttemptAt = new Date(0)
  failSmtp = false
  await processOrderEmailQueue()
  assert.ok(row.sentAt)
  assert.equal(row.attempts, 2)
  assert.equal(row.lastError, null)
})

test('a crashed worker lease can expire and be recovered', async () => {
  row.lockedUntil = new Date(Date.now() + 60_000)
  row.lockToken = 'stale-worker'
  await processOrderEmailQueue()
  assert.equal(sent.length, 0)
  row.lockedUntil = new Date(0)
  await processOrderEmailQueue()
  assert.equal(sent.length, 1)
})

test('cancelled orders, unpaid confirmations and obsolete payment requests are skipped', async () => {
  for (const state of [
    { kind: 'PAID' as const, status: 'CANCELLED' },
    { kind: 'PAID' as const, status: 'PENDING' },
    { kind: 'AWAITING_PAYMENT' as const, status: 'PAID' },
  ]) {
    row = makeRow()
    row.kind = state.kind
    row.order.status = state.status
    await processOrderEmailQueue()
    assert.ok(row.skippedAt)
    assert.equal(sent.length, 0)
  }
})

test('pending bank transfer gets payment instructions without claiming payment succeeded', async () => {
  row.kind = 'AWAITING_PAYMENT'
  row.order.status = 'PENDING'
  row.order.paymentMethod = 'BANK_TRANSFER'
  const settings = structuredClone(DEFAULT_ORDER_EMAIL_SETTINGS)
  settings.uk.bankTransferDetails = 'IBAN UA123 TEST'
  settings.uk.AWAITING_PAYMENT.intro = 'Дякуємо за вашу довіру!'
  mockPrismaMethod(prisma.orderEmailSettings, 'findUnique', async () => ({
    templates: settings,
  }))
  await processOrderEmailQueue()
  assert.match(String(sent[0].text), /Дякуємо за вашу довіру/)
  assert.match(String(sent[0].text), /IBAN UA123 TEST/)
  assert.match(String(sent[0].text), /Призначення платежу: Замовлення #1042/)
  assert.doesNotMatch(String(sent[0].text), /Оплату отримано/)
})

test('missing SMTP configuration or disabled mail leaves jobs available', async () => {
  delete process.env.SMTP_PASSWORD
  assert.equal((await processOrderEmailQueue()).reason, 'smtp_not_configured')
  process.env.ORDER_EMAILS_ENABLED = 'false'
  assert.equal((await processOrderEmailQueue()).reason, 'disabled')
  assert.equal(row.attempts, 0)
  assert.equal(row.sentAt, null)
})

test('queue insertion uses the transaction and skips absent recipients and disabled mail', async () => {
  const insert = mock.fn(async () => ({ count: 1 }))
  const tx = {
    orderEmailDelivery: { createMany: insert },
  } as unknown as Prisma.TransactionClient
  await enqueueOrderEmailTx(tx, { id: 'order-1', customerEmail: null }, 'PAID')
  assert.equal(insert.mock.callCount(), 0)
  await enqueueOrderEmailTx(
    tx,
    { id: 'order-1', customerEmail: 'customer@example.com' },
    'PAID',
  )
  assert.deepEqual(insert.mock.calls[0].arguments, [
    { data: [{ orderId: 'order-1', kind: 'PAID' }], skipDuplicates: true },
  ])
  process.env.ORDER_EMAILS_ENABLED = 'false'
  await enqueueOrderEmailTx(
    tx,
    { id: 'order-1', customerEmail: 'customer@example.com' },
    'PAID',
  )
  assert.equal(insert.mock.callCount(), 1)
})

test('retry backoff doubles and is capped at six hours', () => {
  assert.equal(orderEmailRetryAt(1, new Date(0)).getTime(), 60_000)
  assert.equal(orderEmailRetryAt(2, new Date(0)).getTime(), 120_000)
  assert.equal(
    orderEmailRetryAt(100, new Date(0)).getTime(),
    6 * 60 * 60 * 1000,
  )
})
