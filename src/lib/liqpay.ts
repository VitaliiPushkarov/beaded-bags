import crypto from 'crypto'

export interface LiqPayBasePayload {
  public_key: string
  version: number
  action: string
  amount: number
  currency: string
  description: string
  order_id: string
  result_url: string
  server_url: string
  // LiqPay API technical flag for non-live mode
  sandbox?: 1
  language?: string
  sender_email?: string
  sender_phone?: string
}

export function liqpayEncode(obj: unknown): string {
  const json = JSON.stringify(obj)
  return Buffer.from(json).toString('base64')
}

export function liqpaySign(privateKey: string, data: string): string {
  const str = privateKey + data + privateKey
  const hash = crypto.createHash('sha1').update(str).digest()
  return Buffer.from(hash).toString('base64')
}

export function buildLiqPayPayload(args: {
  publicKey: string
  privateKey: string
  orderId: string
  amountUAH: number
  description: string
  resultUrl: string // sendback URL
  serverUrl: string // webhook LiqPay
  mode?: 'live' | 'development'
  customer?: { name?: string; email?: string; phone?: string }
}): { data: string; signature: string } {
  const payload: LiqPayBasePayload = {
    public_key: args.publicKey,
    version: 3,
    action: 'pay',
    amount: Number(args.amountUAH.toFixed(2)),
    currency: 'UAH',
    description: args.description,
    order_id: args.orderId,
    result_url: args.resultUrl,
    server_url: args.serverUrl,
    language: 'uk',
  }

  if (args.mode === 'development') {
    payload.sandbox = 1
  }

  if (args.customer?.email) payload.sender_email = args.customer.email
  if (args.customer?.phone) payload.sender_phone = args.customer.phone

  const data = liqpayEncode(payload)
  const signature = liqpaySign(args.privateKey, data)
  return { data, signature }
}
