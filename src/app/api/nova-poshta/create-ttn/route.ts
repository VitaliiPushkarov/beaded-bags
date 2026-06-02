import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'

const BodySchema = z.object({
  toName: z.string().trim().min(1).max(120),
  toPhone: z.string().trim().min(8).max(24),
  toCityRef: z.string().trim().min(1).max(120),
  toWarehouseRef: z.string().trim().min(1).max(120),
  weight: z.coerce.number().positive().max(100).optional().default(0.5),
})

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  const parsed = BodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { toName, toPhone, toCityRef, toWarehouseRef, weight } = parsed.data
  const body = {
    apiKey: process.env.NP_KEY,
    modelName: 'InternetDocument',
    calledMethod: 'save',
    methodProperties: {
      PayerType: 'Recipient',
      PaymentMethod: 'Cash',
      DateTime: new Date().toISOString().split('T')[0],
      CargoType: 'Parcel',
      Weight: String(weight),
      ServiceType: 'WarehouseWarehouse',
      SeatsAmount: '1',
      Description: 'Beaded bag',
      Cost: '2000',
      CitySender: process.env.SENDER_CITY_REF,
      SenderAddress: process.env.SENDER_WAREHOUSE_REF,
      ContactSender: process.env.SENDER_REF,
      SendersPhone: '380XXXXXXXXX',
      CityRecipient: toCityRef,
      RecipientAddress: toWarehouseRef,
      ContactRecipient: toName,
      RecipientsPhone: toPhone,
    },
  }

  const r = await fetch(process.env.NP_API!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  const ttn = data?.data?.[0]?.IntDocNumber ?? null
  return NextResponse.json({ ttn, raw: data })
}
