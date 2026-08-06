import nodemailer, { type Transporter } from 'nodemailer'

import {
  buildOrderEmail,
  resolveOrderEmailLocale,
  type OrderEmailKind,
  type OrderEmailLocale,
} from '@/lib/order-email-template'
import { prisma } from '@/lib/prisma'
import { getSiteUrl } from '@/lib/site-url'

// Keep SMTP from holding a request open: the customer must never wait on mail.
const SMTP_CONNECTION_TIMEOUT_MS = 8000
const SMTP_GREETING_TIMEOUT_MS = 8000
const SMTP_SOCKET_TIMEOUT_MS = 10000

type SmtpConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from: string
  replyTo: string | null
}

function readSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const password = process.env.SMTP_PASSWORD?.trim()
  const from = process.env.MAIL_FROM?.trim() || user

  if (!host || !user || !password || !from) return null

  const port = Number(process.env.SMTP_PORT?.trim() || 465)
  const secureRaw = process.env.SMTP_SECURE?.trim().toLowerCase()
  // Port 465 is implicit TLS; 587/25 upgrade via STARTTLS.
  const secure = secureRaw ? secureRaw === 'true' || secureRaw === '1' : port === 465

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 465,
    secure,
    user,
    password,
    from,
    replyTo: process.env.MAIL_REPLY_TO?.trim() || null,
  }
}

let cachedTransporter: Transporter | null = null

function getTransporter(config: SmtpConfig): Transporter {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
      socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    })
  }

  return cachedTransporter
}

function readBankTransferDetails(locale: OrderEmailLocale): string | null {
  const value =
    locale === 'en'
      ? process.env.BANK_TRANSFER_DETAILS_EN?.trim() ||
        process.env.BANK_TRANSFER_DETAILS_UK?.trim()
      : process.env.BANK_TRANSFER_DETAILS_UK?.trim()

  return value || null
}

const ORDER_EMAIL_SELECT = {
  id: true,
  shortNumber: true,
  status: true,
  subtotalUAH: true,
  discountUAH: true,
  deliveryUAH: true,
  totalUAH: true,
  paymentMethod: true,
  shippingMethod: true,
  shippingCountryName: true,
  shippingRegion: true,
  shippingCity: true,
  shippingPostalCode: true,
  shippingAddressLine1: true,
  shippingAddressLine2: true,
  npCityName: true,
  npWarehouseName: true,
  customerName: true,
  customerSurname: true,
  customerEmail: true,
  items: {
    select: {
      name: true,
      color: true,
      modelSize: true,
      pouchColor: true,
      strapName: true,
      priceUAH: true,
      qty: true,
      addons: true,
    },
  },
} as const

// Sends the customer-facing order email. Never throws: mail is a side effect of
// checkout, not a precondition for it — callers wrap this in try/catch anyway,
// but a missing SMTP config must not turn into a failed order either.
export async function sendOrderCustomerEmail(args: {
  orderId: string
  kind: OrderEmailKind
}): Promise<{ sent: boolean; reason?: string }> {
  const config = readSmtpConfig()
  if (!config) {
    console.warn(
      'Order email skipped: SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD/MAIL_FROM)',
    )
    return { sent: false, reason: 'smtp_not_configured' }
  }

  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    select: ORDER_EMAIL_SELECT,
  })

  if (!order) {
    console.warn('Order email skipped: order not found', args.orderId)
    return { sent: false, reason: 'order_not_found' }
  }

  const to = String(order.customerEmail ?? '').trim()
  if (!to) {
    // Email is optional at checkout — this is a normal outcome, not an error.
    console.info('Order email skipped: no customer email', order.id)
    return { sent: false, reason: 'no_customer_email' }
  }

  const locale = resolveOrderEmailLocale(order)
  const bankTransferDetails =
    args.kind === 'AWAITING_PAYMENT' ? readBankTransferDetails(locale) : null

  if (args.kind === 'AWAITING_PAYMENT' && !bankTransferDetails) {
    console.warn(
      `Order email: BANK_TRANSFER_DETAILS_${locale === 'en' ? 'EN' : 'UK'} is not set — sending without payment details`,
    )
  }

  const { subject, html, text } = buildOrderEmail({
    order,
    kind: args.kind,
    locale,
    bankTransferDetails,
    siteUrl: getSiteUrl(locale),
  })

  try {
    await getTransporter(config).sendMail({
      from: config.from,
      to,
      replyTo: config.replyTo ?? undefined,
      subject,
      text,
      html,
    })

    console.info('Order email sent', order.id, args.kind)
    return { sent: true }
  } catch (error) {
    console.error('Order email failed:', error)
    return { sent: false, reason: 'send_failed' }
  }
}

// Convenience wrapper for call sites that just want fire-and-forget semantics
// alongside the existing Telegram notification.
export async function sendOrderCustomerEmailSafe(args: {
  orderId: string
  kind: OrderEmailKind
}): Promise<void> {
  try {
    await sendOrderCustomerEmail(args)
  } catch (error) {
    console.error('Order email unexpected error (non-blocking):', error)
  }
}
