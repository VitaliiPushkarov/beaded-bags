import crypto from 'crypto'

type WayForPayCustomer = {
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
}

type BuildWayForPayPayloadArgs = {
  merchantAccount: string
  merchantSecretKey: string
  orderReference: string
  amountUAH: number
  description: string
  baseUrl: string
  customer?: WayForPayCustomer
}

export function buildWayForPayPayload({
  merchantAccount,
  merchantSecretKey,
  orderReference,
  amountUAH,
  description,
  baseUrl,
  customer,
}: BuildWayForPayPayloadArgs) {
  const merchantDomainName = new URL(baseUrl).hostname
  const orderDate = Math.floor(Date.now() / 1000)
  const amount = Number(amountUAH.toFixed(2))
  const currency = 'UAH'

  // Спрощений кейс: один товар — все замовлення
  const productName = [description]
  const productPrice = [amount]
  const productCount = [1]

  const signatureSource = [
    merchantAccount,
    merchantDomainName,
    orderReference,
    String(orderDate),
    amount.toFixed(2),
    currency,
    ...productName,
    ...productCount.map(String),
    ...productPrice.map((p) => p.toFixed(2)),
  ].join(';')

  const merchantSignature = crypto
    .createHmac('md5', merchantSecretKey)
    .update(signatureSource)
    .digest('hex')

  const payload = {
    merchantAccount,
    merchantDomainName,
    orderReference,
    orderDate,
    amount,
    currency,
    productName,
    productPrice,
    productCount,
    merchantSignature,
    clientEmail: customer?.email,
    clientPhone: customer?.phone,
    clientFirstName: customer?.firstName,
    clientLastName: customer?.lastName,
    language: 'UA',
    returnUrl: `${baseUrl}/checkout/success?orderId=${encodeURIComponent(
      orderReference
    )}`,
    serviceUrl: `${baseUrl}/api/payments/wayforpay/callback`,
  }

  return {
    payload,
    payUrl: 'https://secure.wayforpay.com/pay',
  }
}
