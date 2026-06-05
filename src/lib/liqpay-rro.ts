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

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
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
  deliveryEmail?: string | null
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
        rawTotal: baseUnitPrice * qty,
      },
      strap && strap.extraPriceUAH > 0
        ? {
            label: `${item.name} / Ремінець: ${strap.name}`,
            liqpayGoodId: strap.liqpayGoodId,
            rawTotal: strap.extraPriceUAH * qty,
          }
        : null,
      pouch && pouch.extraPriceUAH > 0
        ? {
            label: `${item.name} / Мішечок: ${pouch.color}`,
            liqpayGoodId: pouch.liqpayGoodId,
            rawTotal: pouch.extraPriceUAH * qty,
          }
        : null,
      size && size.extraPriceUAH > 0
        ? {
            label: `${item.name} / Розмір: ${size.size}`,
            liqpayGoodId: size.liqpayGoodId,
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

      if (!component.liqpayGoodId) {
        throw new Error(
          `Missing LiqPay good ID for fiscal item "${component.label}"`,
        )
      }

      rroItems.push({
        id: component.liqpayGoodId,
        amount: qty,
        price: roundMoney(revenue / qty),
        cost: roundMoney(revenue),
      })
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

  return {
    items: rroItems,
    ...(args.deliveryEmail?.trim()
      ? { delivery_emails: [args.deliveryEmail.trim()] }
      : {}),
  }
}
