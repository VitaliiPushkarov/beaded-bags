import type { PaymentMethod, ProductCostProfile } from '@prisma/client'

export const PAYMENT_FEE_PERCENT_BY_METHOD: Record<PaymentMethod, number> = {
  LIQPAY: 2.5,
  WAYFORPAY: 2.5,
  COD: 0,
  BANK_TRANSFER: 0,
}

export function roundUAH(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value)
}

export function calcPaymentFeeUAH(
  amountUAH: number,
  paymentMethod: PaymentMethod,
): number {
  const rate = PAYMENT_FEE_PERCENT_BY_METHOD[paymentMethod] ?? 0
  return roundUAH((Math.max(0, amountUAH) * rate) / 100)
}

export function getUnitCostUAH(
  profile?: Pick<
    ProductCostProfile,
    | 'materialsCostUAH'
    | 'laborCostUAH'
    | 'packagingCostUAH'
    | 'shippingCostUAH'
    | 'otherCostUAH'
  > | null,
): number {
  if (!profile) return 0

  return (
    roundUAH(profile.materialsCostUAH ?? 0) +
    roundUAH(profile.laborCostUAH ?? 0) +
    roundUAH(profile.packagingCostUAH ?? 0) +
    roundUAH(profile.shippingCostUAH ?? 0) +
    roundUAH(profile.otherCostUAH ?? 0)
  )
}

export function calcGrossMarginPercent(
  revenueUAH: number,
  costUAH: number,
): number {
  const revenue = Math.max(0, revenueUAH)
  if (revenue <= 0) return 0
  return Math.round(((revenue - Math.max(0, costUAH)) / revenue) * 100)
}

type OrderFinancialLineInput = {
  qty: number
  priceUAH: number
  unitCostUAH: number
}

type OrderFinancialSnapshotInput = {
  subtotalUAH: number
  discountUAH: number
  totalUAH: number
  paymentMethod: PaymentMethod
  lines: OrderFinancialLineInput[]
}

export function buildOrderFinancialSnapshot(
  input: OrderFinancialSnapshotInput,
): {
  itemsCostUAH: number
  paymentFeeUAH: number
  grossProfitUAH: number
  lines: Array<{
    qty: number
    priceUAH: number
    discountUAH: number
    lineRevenueUAH: number
    unitCostUAH: number
    totalCostUAH: number
  }>
} {
  const rawLineTotals = input.lines.map((line) =>
    roundUAH(Math.max(0, line.priceUAH) * Math.max(0, line.qty)),
  )

  const subtotal = roundUAH(input.subtotalUAH)
  const orderDiscount = Math.min(roundUAH(input.discountUAH), subtotal)

  let allocatedDiscount = 0
  const discounts = rawLineTotals.map((raw, index) => {
    if (index === rawLineTotals.length - 1) {
      return Math.max(0, orderDiscount - allocatedDiscount)
    }

    const share =
      subtotal > 0 ? roundUAH((raw / subtotal) * orderDiscount) : 0
    allocatedDiscount += share
    return Math.max(0, share)
  })

  const lines = input.lines.map((line, index) => {
    const qty = Math.max(0, roundUAH(line.qty))
    const unitCostUAH = Math.max(0, roundUAH(line.unitCostUAH))
    const totalCostUAH = unitCostUAH * qty
    const lineDiscountUAH = Math.min(discounts[index] ?? 0, rawLineTotals[index] ?? 0)
    const lineRevenueUAH = Math.max(0, (rawLineTotals[index] ?? 0) - lineDiscountUAH)

    return {
      qty,
      priceUAH: Math.max(0, roundUAH(line.priceUAH)),
      discountUAH: lineDiscountUAH,
      lineRevenueUAH,
      unitCostUAH,
      totalCostUAH,
    }
  })

  const itemsCostUAH = lines.reduce((sum, line) => sum + line.totalCostUAH, 0)
  const paymentFeeUAH = calcPaymentFeeUAH(input.totalUAH, input.paymentMethod)
  const grossProfitUAH =
    Math.max(0, roundUAH(input.totalUAH)) - itemsCostUAH - paymentFeeUAH

  return {
    itemsCostUAH,
    paymentFeeUAH,
    grossProfitUAH,
    lines,
  }
}
