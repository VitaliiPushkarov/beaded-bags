import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { buildLiqPayPayload } from '@/lib/liqpay'
import { buildLiqPayCatalogExternalCode } from '@/lib/liqpay-catalog'
import {
  buildLiqPayRroInfo,
  LiqPayFiscalConfigError,
  LiqPayFiscalTotalError,
} from '@/lib/liqpay-rro'
import {
  sendLiqPayFiscalAlert,
  sendLiqPayFiscalTotalAlert,
} from '@/lib/order-telegram'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const BodySchema = z.object({
  orderId: z.string().min(1),
})

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, '')
}

function resolveBaseUrl(req: NextRequest): string {
  const hostHeader =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  const host = hostHeader.split(',')[0]?.trim()
  const protoHeader = req.headers.get('x-forwarded-proto') ?? 'https'
  const proto = protoHeader.split(',')[0]?.trim() || 'https'

  if (host) return `${proto}://${host}`

  const envBase = process.env.APP_BASE_URL?.trim()
  if (envBase) return normalizeBaseUrl(envBase)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (siteUrl) return normalizeBaseUrl(siteUrl)

  return 'http://localhost:3000'
}

function resolveLiqPayMode(publicKey: string): 'live' | 'development' {
  const rawMode = process.env.LIQPAY_MODE?.trim().toLowerCase()
  if (rawMode === 'live' || rawMode === 'prod' || rawMode === 'production') {
    return 'live'
  }

  // Any explicit non-live mode value is treated as development mode.
  if (rawMode) return 'development'

  // Auto-detect by key prefix when mode is not set.
  return publicKey.startsWith('sandbox_') ? 'development' : 'live'
}

export async function POST(req: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { orderId } = parsed.data

    const publicKey = process.env.LIQPAY_PUBLIC_KEY?.trim()
    const privateKey = process.env.LIQPAY_PRIVATE_KEY?.trim()
    const baseUrl = resolveBaseUrl(req)

    if (!publicKey || !privateKey) {
      return NextResponse.json(
        { error: 'Missing LiqPay keys' },
        { status: 500 },
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        shortNumber: true,
        totalUAH: true,
        deliveryUAH: true,
        status: true,
        paymentMethod: true,
        paymentRaw: true,
        customerEmail: true,
        customerPhone: true,
        items: {
          select: {
            name: true,
            qty: true,
            priceUAH: true,
            discountUAH: true,
            lineRevenueUAH: true,
            variantId: true,
            strapId: true,
            sizeId: true,
            pouchId: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.status === 'PAID') {
      return NextResponse.json(
        { error: 'Order is already paid' },
        { status: 409 },
      )
    }

    if (order.paymentMethod !== 'LIQPAY') {
      return NextResponse.json(
        { error: 'Order payment method is not LIQPAY' },
        { status: 400 },
      )
    }

    const liqPayMode = resolveLiqPayMode(publicKey)
    const variantIds = Array.from(
      new Set(
        order.items
          .map((item) => item.variantId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    )
    const strapIds = Array.from(
      new Set(
        order.items
          .map((item) => item.strapId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    )
    const sizeIds = Array.from(
      new Set(
        order.items
          .map((item) => item.sizeId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    )
    const pouchIds = Array.from(
      new Set(
        order.items
          .map((item) => item.pouchId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    )
    const catalogCodes = [
      ...variantIds.map((id) => buildLiqPayCatalogExternalCode('VARIANT', id)),
      ...strapIds.map((id) => buildLiqPayCatalogExternalCode('STRAP', id)),
      ...sizeIds.map((id) => buildLiqPayCatalogExternalCode('SIZE', id)),
      ...pouchIds.map((id) => buildLiqPayCatalogExternalCode('POUCH', id)),
    ]

    const [variants, straps, sizes, pouches, catalogMappings] = await Promise.all([
      variantIds.length
        ? prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: {
              id: true,
              liqpayGoodId: true,
            },
          })
        : Promise.resolve([]),
      strapIds.length
        ? prisma.productVariantStrap.findMany({
            where: { id: { in: strapIds } },
            select: {
              id: true,
              name: true,
              extraPriceUAH: true,
              liqpayGoodId: true,
            },
          })
        : Promise.resolve([]),
      sizeIds.length
        ? prisma.productVariantSize.findMany({
            where: { id: { in: sizeIds } },
            select: {
              id: true,
              size: true,
              extraPriceUAH: true,
              liqpayGoodId: true,
            },
          })
        : Promise.resolve([]),
      pouchIds.length
        ? prisma.productVariantPouch.findMany({
            where: { id: { in: pouchIds } },
            select: {
              id: true,
              color: true,
              extraPriceUAH: true,
              liqpayGoodId: true,
            },
          })
        : Promise.resolve([]),
      catalogCodes.length
        ? prisma.liqPayCatalogMapping.findMany({
            where: {
              externalCode: {
                in: catalogCodes,
              },
            },
            select: {
              externalCode: true,
              liqpayGoodId: true,
            },
          })
        : Promise.resolve([]),
    ])

    let rroInfo
    try {
      rroInfo = buildLiqPayRroInfo({
        items: order.items,
        variantsById: new Map(variants.map((variant) => [variant.id, variant])),
        strapsById: new Map(straps.map((strap) => [strap.id, strap])),
        sizesById: new Map(sizes.map((size) => [size.id, size])),
        pouchesById: new Map(pouches.map((pouch) => [pouch.id, pouch])),
        mappingsByExternalCode: new Map(
          catalogMappings.map((item) => [item.externalCode, item.liqpayGoodId]),
        ),
        deliveryEmail: order.customerEmail ?? null,
        // The fiscal lines cover goods only. Delivery is 0 today (Nova Poshta is
        // paid by the recipient); if it ever becomes a charge it needs its own
        // catalogue good, so it is excluded here rather than silently breaking
        // every card payment on the day it is switched on.
        expectedTotalUAH: order.totalUAH - order.deliveryUAH,
      })
    } catch (error) {
      if (error instanceof LiqPayFiscalTotalError) {
        // The receipt would not add up to the amount about to be charged, so
        // LiqPay would take the money and then refuse to fiscalize it. Stop
        // before the payment rather than after.
        console.error(
          `LiqPay fiscal total mismatch for order #${order.shortNumber}: ${error.message}`,
        )

        await sendLiqPayFiscalTotalAlert({
          orderShortNumber: order.shortNumber,
          fiscalTotalUAH: error.fiscalTotalUAH,
          expectedTotalUAH: error.expectedTotalUAH,
        })

        return NextResponse.json(
          {
            error: {
              code: 'FISCAL_NOT_CONFIGURED',
              orderNumber: order.shortNumber,
            },
          },
          { status: 503 },
        )
      }

      if (error instanceof LiqPayFiscalConfigError) {
        // The shop, not the customer, is misconfigured: this item has no LiqPay
        // good ID, so no fiscal receipt can be issued and the payment cannot be
        // created. The order already exists, so alert the shop and let checkout
        // offer a way forward instead of dead-ending on a generic error.
        console.error(
          `LiqPay fiscal config missing for order #${order.shortNumber}: ${error.message}`,
        )

        await sendLiqPayFiscalAlert({
          orderShortNumber: order.shortNumber,
          itemLabel: error.itemLabel,
          catalogCode: error.catalogCode,
        })

        return NextResponse.json(
          {
            error: {
              code: 'FISCAL_NOT_CONFIGURED',
              orderNumber: order.shortNumber,
            },
          },
          { status: 503 },
        )
      }

      throw error
    }

    // PrivatBank "Оплата частинами": if the order was placed as an installment
    // checkout, restrict the LiqPay page to the paypart flow.
    const installments =
      order.paymentRaw &&
      typeof order.paymentRaw === 'object' &&
      !Array.isArray(order.paymentRaw)
        ? (order.paymentRaw as { installments?: unknown }).installments
        : undefined
    const paytypes = installments === 'paypart' ? 'paypart' : undefined

    const { data, signature } = buildLiqPayPayload({
      publicKey,
      privateKey,
      orderId: order.id,
      amountUAH: order.totalUAH,
      description: `Замовлення #${order.shortNumber}`,
      resultUrl: `${baseUrl}/api/payments/liqpay/return?orderId=${encodeURIComponent(order.id)}`,
      serverUrl: `${baseUrl}/api/payments/liqpay/callback`,
      mode: liqPayMode,
      customer: {
        email: order.customerEmail ?? undefined,
        phone: order.customerPhone ?? undefined,
      },
      rroInfo,
      paytypes,
    })

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'CREATED',
      },
    })

    return NextResponse.json({
      checkoutUrl: 'https://www.liqpay.ua/api/3/checkout',
      data,
      signature,
      orderNumber: order.shortNumber,
    })
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.error('liqpay create error:', e.message)
    } else {
      console.error('Create order error:', e)
    }

    return NextResponse.json({ error: 'liqpay create failed' }, { status: 500 })
  }
}
