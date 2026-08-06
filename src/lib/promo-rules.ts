// Promo evaluation. Pure — no prisma, no request — so every rule is testable
// and the same logic backs both the cart preview and the authoritative check at
// order creation.

export type PromoRecord = {
  code: string
  discountPercent: number
  isActive: boolean
  startsAt: Date | null
  endsAt: Date | null
  minOrderUAH: number
  usageLimit: number | null
  usedCount: number
}

export type PromoRejectionReason =
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'usage_limit_reached'
  | 'below_min_order'

export type PromoEvaluation =
  | {
      ok: true
      code: string
      discountPercent: number
      discountUAH: number
    }
  | {
      ok: false
      reason: PromoRejectionReason
      // Present for below_min_order so the shopper can be told how much more
      // they need rather than just "invalid".
      minOrderUAH?: number
    }

export function normalizePromoCode(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
}

export function calcPromoDiscountUAH(
  subtotalUAH: number,
  discountPercent: number,
): number {
  const subtotal = Math.max(0, Math.round(Number(subtotalUAH) || 0))
  const percent = Math.min(100, Math.max(0, Math.round(Number(discountPercent) || 0)))
  if (subtotal <= 0 || percent <= 0) return 0

  // Never discount below zero, and never more than the order itself.
  return Math.min(subtotal, Math.round((subtotal * percent) / 100))
}

export function evaluatePromo(
  promo: PromoRecord | null | undefined,
  args: { subtotalUAH: number; now?: Date },
): PromoEvaluation {
  if (!promo) return { ok: false, reason: 'not_found' }
  if (!promo.isActive) return { ok: false, reason: 'inactive' }

  const now = args.now ?? new Date()

  if (promo.startsAt && now < promo.startsAt) {
    return { ok: false, reason: 'not_started' }
  }
  if (promo.endsAt && now > promo.endsAt) {
    return { ok: false, reason: 'expired' }
  }
  if (
    typeof promo.usageLimit === 'number' &&
    promo.usedCount >= promo.usageLimit
  ) {
    return { ok: false, reason: 'usage_limit_reached' }
  }

  const subtotalUAH = Math.max(0, Math.round(Number(args.subtotalUAH) || 0))
  if (promo.minOrderUAH > 0 && subtotalUAH < promo.minOrderUAH) {
    return {
      ok: false,
      reason: 'below_min_order',
      minOrderUAH: promo.minOrderUAH,
    }
  }

  return {
    ok: true,
    code: promo.code,
    discountPercent: promo.discountPercent,
    discountUAH: calcPromoDiscountUAH(subtotalUAH, promo.discountPercent),
  }
}

const REJECTION_MESSAGES: Record<
  PromoRejectionReason,
  { uk: string; en: string }
> = {
  not_found: {
    uk: 'Такого промокоду не існує',
    en: 'This promo code does not exist',
  },
  inactive: {
    uk: 'Промокод більше не діє',
    en: 'This promo code is no longer active',
  },
  not_started: {
    uk: 'Промокод ще не активний',
    en: 'This promo code is not active yet',
  },
  expired: {
    uk: 'Термін дії промокоду минув',
    en: 'This promo code has expired',
  },
  usage_limit_reached: {
    uk: 'Промокод вичерпано',
    en: 'This promo code has been fully redeemed',
  },
  below_min_order: {
    uk: 'Сума замовлення замала для цього промокоду',
    en: 'The order total is too low for this promo code',
  },
}

export function describePromoRejection(
  evaluation: Extract<PromoEvaluation, { ok: false }>,
  locale: 'uk' | 'en',
): string {
  const base = REJECTION_MESSAGES[evaluation.reason][locale]

  if (evaluation.reason === 'below_min_order' && evaluation.minOrderUAH) {
    return locale === 'en'
      ? `${base} (from ${evaluation.minOrderUAH} UAH)`
      : `${base} (від ${evaluation.minOrderUAH} ₴)`
  }

  return base
}
