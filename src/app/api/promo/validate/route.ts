import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { resolvePromoCode } from '@/lib/promo-server'
import { describePromoRejection } from '@/lib/promo-rules'

export const runtime = 'nodejs'

const BodySchema = z.object({
  code: z.string().trim().min(1).max(64),
  subtotalUAH: z.number().min(0),
  locale: z.enum(['uk', 'en']).optional().default('uk'),
})

// Cart/checkout preview only. The order route re-checks the code against the
// repriced subtotal, so nothing here is trusted when the order is created.
export async function POST(req: NextRequest) {
  try {
    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ valid: false }, { status: 400 })
    }

    const { code, subtotalUAH, locale } = parsed.data
    const evaluation = await resolvePromoCode(code, subtotalUAH)

    if (!evaluation.ok) {
      return NextResponse.json({
        valid: false,
        reason: evaluation.reason,
        message: describePromoRejection(evaluation, locale),
      })
    }

    return NextResponse.json({
      valid: true,
      code: evaluation.code,
      discountPercent: evaluation.discountPercent,
      discountUAH: evaluation.discountUAH,
    })
  } catch (error) {
    console.error('Promo validate error:', error)
    return NextResponse.json({ valid: false }, { status: 500 })
  }
}
