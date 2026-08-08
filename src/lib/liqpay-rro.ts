import {
  buildLiqPayCatalogExternalCode,
  resolveLiqPayGoodId,
} from '@/lib/liqpay-catalog'

type RroOrderItem = {
  name: string
  qty: number
  priceUAH: number
  discountUAH: number
  lineRevenueUAH: number
  variantId?: string | null
  strapId?: string | null
  sizeId?: string | null
  pouchId?: string | null
}

type VariantRroSource = {
  id: string
  liqpayGoodId: number | null
}

type StrapRroSource = {
  id: string
  name: string
  extraPriceUAH: number
  liqpayGoodId: number | null
}

type PouchRroSource = {
  id: string
  color: string
  extraPriceUAH: number
  liqpayGoodId: number | null
}

type SizeRroSource = {
  id: string
  size: string
  extraPriceUAH: number
  liqpayGoodId: number | null
}

type RroItem = {
  id: number
  amount: number
  price: number
  cost: number
}

// Raised when the fiscal catalogue is not configured for something in the cart.
// This is a shop configuration problem, not a customer problem: the payment
// cannot be created until the item has a LiqPay good ID. Typed so the payment
// route can tell it apart from a genuine LiqPay failure, alert the shop, and
// give the customer a way forward instead of a dead end.
export class LiqPayFiscalConfigError extends Error {
  readonly itemLabel: string
  readonly catalogCode: string

  constructor(args: { itemLabel: string; catalogCode: string }) {
    super(
      `Missing LiqPay good ID for fiscal item "${args.itemLabel}" (catalog code: ${args.catalogCode})`,
    )
    this.name = 'LiqPayFiscalConfigError'
    this.itemLabel = args.itemLabel
    this.catalogCode = args.catalogCode
  }
}

// Raised when the fiscal lines do not add up to the amount being charged.
// Distinct from LiqPayFiscalConfigError: nothing is missing from the catalogue,
// the arithmetic itself disagrees, which points at the discount allocation
// rather than at shop data.
export class LiqPayFiscalTotalError extends Error {
  readonly fiscalTotalUAH: number
  readonly expectedTotalUAH: number

  constructor(args: { fiscalTotalUAH: number; expectedTotalUAH: number }) {
    super(
      `Fiscal receipt total ${args.fiscalTotalUAH} does not match the charged amount ${args.expectedTotalUAH}`,
    )
    this.name = 'LiqPayFiscalTotalError'
    this.fiscalTotalUAH = args.fiscalTotalUAH
    this.expectedTotalUAH = args.expectedTotalUAH
  }
}

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

// LiqPay defines a fiscal line as "number of units * unit cost", so `cost` must
// equal `price * amount` to the kopiyka. Dividing the discounted line revenue by
// the quantity does not always give a whole number of kopiykas — 7 units of
// 1599 UAH less 10% is 1439.142857… per unit — and the rounded price then no
// longer multiplies back to the amount actually charged. A receipt whose total
// disagrees with the payment is rejected, so instead of rounding, the units are
// split across two lines of the same good: the remainder kopiykas go to the
// dearer line. 7 x 1439.142857… becomes 5 x 1439.14 + 2 x 1439.15 = 10074.00,
// which is exact.
function splitFiscalUnits(revenueUAH: number, qty: number) {
  const revenueKop = Math.round(revenueUAH * 100)
  const baseKop = Math.floor(revenueKop / qty)
  const dearUnits = revenueKop - baseKop * qty
  const cheapUnits = qty - dearUnits

  const lines: Array<{ amount: number; priceKop: number }> = []
  if (cheapUnits > 0) lines.push({ amount: cheapUnits, priceKop: baseKop })
  if (dearUnits > 0) lines.push({ amount: dearUnits, priceKop: baseKop + 1 })

  return lines.map((line) => ({
    amount: line.amount,
    price: line.priceKop / 100,
    cost: (line.priceKop * line.amount) / 100,
  }))
}

function allocateDiscounts(rawTotals: number[], totalDiscount: number) {
  const subtotal = rawTotals.reduce((sum, value) => sum + Math.max(0, value), 0)
  const discounts: number[] = []
  let allocated = 0

  for (let index = 0; index < rawTotals.length; index += 1) {
    const raw = Math.max(0, rawTotals[index] ?? 0)
    if (index === rawTotals.length - 1) {
      discounts.push(Math.max(0, totalDiscount - allocated))
      continue
    }

    const share =
      subtotal > 0 ? Math.round((raw / subtotal) * totalDiscount) : 0
    allocated += share
    discounts.push(Math.max(0, share))
  }

  return discounts.map((discount, index) =>
    Math.min(discount, Math.max(0, rawTotals[index] ?? 0)),
  )
}

export function buildLiqPayRroInfo(args: {
  items: RroOrderItem[]
  variantsById: Map<string, VariantRroSource>
  strapsById: Map<string, StrapRroSource>
  pouchesById: Map<string, PouchRroSource>
  sizesById: Map<string, SizeRroSource>
  mappingsByExternalCode?: ReadonlyMap<string, number>
  deliveryEmail?: string | null
  // The amount the customer is actually charged. The fiscal receipt has to add
  // up to it exactly, so it is checked here rather than discovered later as a
  // silent fiscalization failure.
  expectedTotalUAH?: number
}) {
  const rroItems: RroItem[] = []

  for (const item of args.items) {
    const qty = Math.max(0, Math.trunc(Number(item.qty) || 0))
    if (qty <= 0) continue

    const lineUnitPrice = Math.max(0, Math.round(Number(item.priceUAH) || 0))
    const rawLineTotal = lineUnitPrice * qty
    const lineDiscount = Math.min(
      Math.max(0, Math.round(Number(item.discountUAH) || 0)),
      rawLineTotal,
    )
    const lineRevenue = Math.max(
      0,
      Math.round(Number(item.lineRevenueUAH) || rawLineTotal - lineDiscount),
    )

    const variant = item.variantId
      ? args.variantsById.get(item.variantId) ?? null
      : null
    const strap = item.strapId
      ? args.strapsById.get(item.strapId) ?? null
      : null
    const pouch = item.pouchId
      ? args.pouchesById.get(item.pouchId) ?? null
      : null
    const size = item.sizeId ? args.sizesById.get(item.sizeId) ?? null : null

    if (!variant) {
      throw new Error(
        `Missing product variant mapping for order item "${item.name}"`,
      )
    }

    const extraTotalPerUnit =
      Math.max(0, strap?.extraPriceUAH ?? 0) +
      Math.max(0, pouch?.extraPriceUAH ?? 0) +
      Math.max(0, size?.extraPriceUAH ?? 0)

    const baseUnitPrice = lineUnitPrice - extraTotalPerUnit
    if (baseUnitPrice < 0) {
      throw new Error(
        `Selected options exceed base price for order item "${item.name}"`,
      )
    }

    const components = [
      {
        label: item.name,
        liqpayGoodId: variant.liqpayGoodId,
        entityType: 'VARIANT' as const,
        entityId: variant.id,
        catalogCode: buildLiqPayCatalogExternalCode('VARIANT', variant.id),
        rawTotal: baseUnitPrice * qty,
      },
      strap && strap.extraPriceUAH > 0
        ? {
            label: `${item.name} / Ремінець: ${strap.name}`,
            liqpayGoodId: strap.liqpayGoodId,
            entityType: 'STRAP' as const,
            entityId: strap.id,
            catalogCode: buildLiqPayCatalogExternalCode('STRAP', strap.id),
            rawTotal: strap.extraPriceUAH * qty,
          }
        : null,
      pouch && pouch.extraPriceUAH > 0
        ? {
            label: `${item.name} / Мішечок: ${pouch.color}`,
            liqpayGoodId: pouch.liqpayGoodId,
            entityType: 'POUCH' as const,
            entityId: pouch.id,
            catalogCode: buildLiqPayCatalogExternalCode('POUCH', pouch.id),
            rawTotal: pouch.extraPriceUAH * qty,
          }
        : null,
      size && size.extraPriceUAH > 0
        ? {
            label: `${item.name} / Розмір: ${size.size}`,
            liqpayGoodId: size.liqpayGoodId,
            entityType: 'SIZE' as const,
            entityId: size.id,
            catalogCode: buildLiqPayCatalogExternalCode('SIZE', size.id),
            rawTotal: size.extraPriceUAH * qty,
          }
        : null,
    ].filter((component): component is NonNullable<typeof component> =>
      Boolean(component),
    )

    const componentDiscounts = allocateDiscounts(
      components.map((component) => component.rawTotal),
      lineDiscount,
    )

    components.forEach((component, index) => {
      const revenue = Math.max(
        0,
        component.rawTotal - (componentDiscounts[index] ?? 0),
      )
      if (revenue <= 0) return

      const resolvedGoodId = resolveLiqPayGoodId({
        entityType: component.entityType,
        entityId: component.entityId,
        manualGoodId: component.liqpayGoodId,
        mappingsByExternalCode: args.mappingsByExternalCode,
      })

      if (!resolvedGoodId) {
        throw new LiqPayFiscalConfigError({
          itemLabel: component.label,
          catalogCode: component.catalogCode,
        })
      }

      for (const unit of splitFiscalUnits(revenue, qty)) {
        rroItems.push({
          id: resolvedGoodId,
          amount: unit.amount,
          price: unit.price,
          cost: unit.cost,
        })
      }
    })

    const componentsTotal = roundMoney(
      components.reduce(
        (sum, component, index) =>
          sum + Math.max(0, component.rawTotal - (componentDiscounts[index] ?? 0)),
        0,
      ),
    )

    if (componentsTotal !== roundMoney(lineRevenue)) {
      throw new Error(
        `Fiscal line total mismatch for order item "${item.name}"`,
      )
    }
  }

  if (rroItems.length === 0) {
    throw new Error('No fiscal items available for LiqPay RRO')
  }

  // The receipt must total the payment. If it does not, LiqPay refuses the
  // fiscalization after the money has already been taken — the order is paid but
  // no receipt exists, which is the worst outcome available. Refusing here turns
  // that into a payment that never starts, which the checkout can explain.
  const fiscalTotal = roundMoney(
    rroItems.reduce((sum, item) => sum + item.cost, 0),
  )

  if (
    args.expectedTotalUAH !== undefined &&
    fiscalTotal !== roundMoney(args.expectedTotalUAH)
  ) {
    throw new LiqPayFiscalTotalError({
      fiscalTotalUAH: fiscalTotal,
      expectedTotalUAH: roundMoney(args.expectedTotalUAH),
    })
  }

  return {
    items: rroItems,
    ...(args.deliveryEmail?.trim()
      ? { delivery_emails: [args.deliveryEmail.trim()] }
      : {}),
  }
}
