import type { OrderStatus, Prisma } from '@prisma/client'

import { liqpayEncode, liqpaySign } from '@/lib/liqpay'
import {
  mapLiqPayOrderStatus,
  type LiqPayStatusPayload,
} from '@/lib/liqpay-payment-status'
import { sendOrderTelegramNotification } from '@/lib/order-telegram'
import {
  applyPaidOrderInventoryTx,
  type PaidOrderInventoryResult,
  revalidateInventoryProductViews,
} from '@/lib/product-inventory'
import { prisma } from '@/lib/prisma'

const LIQPAY_STATUS_API_URL = 'https://www.liqpay.ua/api/request'
const LIQPAY_STATUS_TIMEOUT_MS = 3000

export type LiqPayDecodedPayload = LiqPayStatusPayload & {
  order_id?: string
  transaction_id?: string | number
}

export type OrderSettlementSnapshot = {
  id: string
  shortNumber: number
  status: OrderStatus
  paymentStatus: string | null
  paymentMethod: 'LIQPAY' | 'BANK_TRANSFER'
}

function toTrimmedString(value: unknown): string {
  return String(value ?? '').trim()
}

export async function loadOrderSettlementSnapshot(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      shortNumber: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
    },
  })
}

export async function settleOrderFromLiqPayPayload(args: {
  orderId: string
  payload: LiqPayDecodedPayload
}) {
  const existing = await loadOrderSettlementSnapshot(args.orderId)
  if (!existing) return null

  const paymentStatus = toTrimmedString(args.payload.status) || null
  const mappedOrderStatus = mapLiqPayOrderStatus({
    ...args.payload,
    status: paymentStatus,
  })

  const updateData: Prisma.OrderUpdateInput = {
    paymentStatus,
    paymentRaw: args.payload as Prisma.InputJsonValue,
  }

  const paymentId = toTrimmedString(args.payload.transaction_id)
  if (paymentId) {
    updateData.paymentId = paymentId
  }

  let transitionedToPaid = false
  let inventorySettlement: PaidOrderInventoryResult = {
    applied: false,
    affectedProductIds: [],
    productSnapshots: [],
  }

  if (mappedOrderStatus === 'PAID') {
    inventorySettlement = await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: existing.id },
        data: updateData,
      })

      const result = await tx.order.updateMany({
        where: {
          id: existing.id,
          status: {
            not: 'PAID',
          },
        },
        data: {
          status: 'PAID',
        },
      })
      transitionedToPaid = result.count > 0

      return applyPaidOrderInventoryTx(tx, existing.id)
    })
  } else if (mappedOrderStatus) {
    await prisma.order.update({
      where: { id: existing.id },
      data: updateData,
    })

    await prisma.order.updateMany({
      where: {
        id: existing.id,
        status: {
          not: 'PAID',
        },
      },
      data: {
        status: mappedOrderStatus,
      },
    })
  } else {
    await prisma.order.update({
      where: { id: existing.id },
      data: updateData,
    })
  }

  if (inventorySettlement.applied) {
    revalidateInventoryProductViews(inventorySettlement.productSnapshots)
  }

  if (transitionedToPaid) {
    try {
      await sendOrderTelegramNotification(existing.id)
    } catch (error) {
      console.error('LiqPay settlement Telegram error:', error)
    }
  }

  return loadOrderSettlementSnapshot(existing.id)
}

export async function refreshOrderFromLiqPayStatusApi(orderId: string) {
  const publicKey = process.env.LIQPAY_PUBLIC_KEY?.trim()
  const privateKey = process.env.LIQPAY_PRIVATE_KEY?.trim()

  if (!publicKey || !privateKey) {
    console.warn('LiqPay status refresh skipped: missing LiqPay keys')
    return loadOrderSettlementSnapshot(orderId)
  }

  const requestPayload = {
    action: 'status',
    version: 3,
    public_key: publicKey,
    order_id: orderId,
  }

  const data = liqpayEncode(requestPayload)
  const signature = liqpaySign(privateKey, data)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LIQPAY_STATUS_TIMEOUT_MS)

  try {
    const res = await fetch(LIQPAY_STATUS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ data, signature }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('LiqPay status refresh failed:', res.status, body)
      return loadOrderSettlementSnapshot(orderId)
    }

    const text = await res.text()
    const decoded = JSON.parse(text) as LiqPayDecodedPayload
    const payloadOrderId = toTrimmedString(decoded.order_id)

    if (payloadOrderId && payloadOrderId !== orderId) {
      console.error(
        'LiqPay status refresh order mismatch:',
        orderId,
        payloadOrderId,
      )
      return loadOrderSettlementSnapshot(orderId)
    }

    return settleOrderFromLiqPayPayload({
      orderId,
      payload: decoded,
    })
  } catch (error) {
    console.error('LiqPay status refresh error:', error)
    return loadOrderSettlementSnapshot(orderId)
  } finally {
    clearTimeout(timeout)
  }
}
