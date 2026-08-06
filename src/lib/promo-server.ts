import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  evaluatePromo,
  normalizePromoCode,
  type PromoEvaluation,
} from '@/lib/promo-rules'

const PROMO_SELECT = {
  code: true,
  discountPercent: true,
  isActive: true,
  startsAt: true,
  endsAt: true,
  minOrderUAH: true,
  usageLimit: true,
  usedCount: true,
} as const

// Look a code up and apply every rule to it. Used both for the cart preview and
// as the authoritative check when an order is created, so the two can never
// disagree.
export async function resolvePromoCode(
  rawCode: string | null | undefined,
  subtotalUAH: number,
): Promise<PromoEvaluation> {
  const code = normalizePromoCode(rawCode)
  if (!code) return { ok: false, reason: 'not_found' }

  const promo = await prisma.promoCode.findUnique({
    where: { code },
    select: PROMO_SELECT,
  })

  return evaluatePromo(promo, { subtotalUAH })
}

// Count a redemption. Called inside the order-creation transaction so the
// counter cannot drift from the orders that actually used the code.
export async function recordPromoRedemption(
  tx: Prisma.TransactionClient,
  code: string,
) {
  const normalized = normalizePromoCode(code)
  if (!normalized) return

  await tx.promoCode.updateMany({
    where: { code: normalized },
    data: { usedCount: { increment: 1 } },
  })
}

// The code offered to the customer after a successful order. Only codes that
// are currently redeemable are shown — there is no point advertising one that
// is expired or exhausted. The most recently updated wins if several are
// flagged.
export async function getPostOrderPromo(): Promise<{
  code: string
  discountPercent: number
} | null> {
  const now = new Date()

  const promo = await prisma.promoCode.findFirst({
    where: {
      showAfterOrder: true,
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    select: PROMO_SELECT,
  })

  if (!promo) return null

  // Re-run the full rules so an exhausted code is not advertised.
  const evaluation = evaluatePromo(promo, { subtotalUAH: promo.minOrderUAH })
  if (!evaluation.ok) return null

  return { code: promo.code, discountPercent: promo.discountPercent }
}
