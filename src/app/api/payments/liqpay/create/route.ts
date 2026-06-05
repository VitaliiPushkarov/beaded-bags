import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { buildLiqPayPayload } from '@/lib/liqpay'
import { buildLiqPayRroInfo } from '@/lib/liqpay-rro'
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
        status: true,
        paymentMethod: true,
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

    const [variants, straps, sizes, pouches] = await Promise.all([
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
    ])

    const rroInfo = buildLiqPayRroInfo({
      items: order.items,
      variantsById: new Map(variants.map((variant) => [variant.id, variant])),
      strapsById: new Map(straps.map((strap) => [strap.id, strap])),
      sizesById: new Map(sizes.map((size) => [size.id, size])),
      pouchesById: new Map(pouches.map((pouch) => [pouch.id, pouch])),
      deliveryEmail: order.customerEmail ?? null,
    })

    const { data, signature } = buildLiqPayPayload({
      publicKey,
      privateKey,
      orderId: order.id,
      amountUAH: order.totalUAH,
      description: `Замовлення #${order.shortNumber}`,
      resultUrl: `${baseUrl}/api/payments/liqpay/return`,
      serverUrl: `${baseUrl}/api/payments/liqpay/callback`,
      mode: liqPayMode,
      customer: {
        email: order.customerEmail ?? undefined,
        phone: order.customerPhone ?? undefined,
      },
      rroInfo,
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
