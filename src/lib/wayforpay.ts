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

  // ВАЖЛИВО: одразу робимо СТРОКОВІ значення і їх же використовуємо і в підписі, і в payload
  const amount = amountUAH.toFixed(2) // напр. "2399.00"
  const currency = 'UAH'

  // Спрощено: одне "позиційне" найменування — все замовлення
  const productName = [description] // ["Замовлення #123"]
  const productPrice = [amount] // ["2399.00"]
  const productCount = ['1'] // ["1"]

  // Формуємо рядок для підпису згідно з Accept Payment (Purchase)
  const signatureSource = [
    merchantAccount,
    merchantDomainName,
    orderReference,
    String(orderDate),
    amount,
    currency,
    ...productName,
    ...productCount,
    ...productPrice,
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
    returnUrl: `${baseUrl}/checkout/success?order=${encodeURIComponent(
      orderReference
    )}`,
    serviceUrl: `${baseUrl}/api/payments/wayforpay/callback`,
  }

  return {
    payload,
    payUrl: 'https://secure.wayforpay.com/pay',
  }
}
