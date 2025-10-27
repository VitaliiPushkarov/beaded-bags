import crypto from 'crypto'

export function liqpayEncode(obj: any) {
  const json = JSON.stringify(obj)
  return Buffer.from(json).toString('base64')
}

export function liqpaySign(privateKey: string, data: string) {
  const str = privateKey + data + privateKey
  const sha1 = crypto.createHash('sha1').update(str).digest()
  return Buffer.from(sha1).toString('base64')
}

export function buildLiqPayPayload(args: {
  publicKey: string
  privateKey: string
  orderId: string
  amountUAH: number
  description: string
  resultUrl: string // sendback URL
  serverUrl: string // webhook LiqPay
  customer?: { name?: string; email?: string; phone?: string }
}) {
  const payload: any = {
    public_key: args.publicKey,
    version: 3,
    action: 'pay',
    amount: Number(args.amountUAH.toFixed(2)),
    currency: 'UAH',
    description: args.description,
    order_id: args.orderId, // unique order ID
    result_url: args.resultUrl,
    server_url: args.serverUrl,
    sandbox: 1, // ← testing mode, прибрати в продакшн
    language: 'uk',
  }

  if (args.customer?.email) payload.sender_email = args.customer.email
  if (args.customer?.phone) payload.sender_phone = args.customer.phone

  const data = liqpayEncode(payload)
  const signature = liqpaySign(args.privateKey, data)
  return { data, signature }
}
