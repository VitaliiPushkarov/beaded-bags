import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const {
    toName,
    toPhone,
    toCityRef,
    toWarehouseRef,
    weight = 0.5,
  } = await req.json()
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
