import nodemailer, { type Transporter } from 'nodemailer'
import {
  buildOrderEmail,
  resolveOrderEmailLocale,
  type OrderEmailKind,
  type OrderEmailOrder,
} from './order-email-template'
import { readOrderSmtpConfig } from './order-email-config'
import { getOrderEmailSettings } from './order-email-settings'
import { getSiteUrl } from './site-url'

let cachedTransporter: Transporter | null = null

// The queue records success only after SMTP accepts the message.
// Transport errors propagate to the worker for automatic retry.
export async function deliverOrderEmail(args: {
  deliveryId: string
  order: OrderEmailOrder & { customerEmail: string | null }
  kind: OrderEmailKind
}): Promise<void> {
  const config = readOrderSmtpConfig()
  if (!config) throw new Error('smtp_not_configured')
  if (!args.order.customerEmail?.trim()) throw new Error('no_customer_email')
  const locale = resolveOrderEmailLocale(args.order)
  const settings = await getOrderEmailSettings()
  const message = buildOrderEmail({
    order: args.order,
    kind: args.kind,
    locale,
    copy: settings[locale][args.kind],
    bankTransferDetails: settings[locale].bankTransferDetails,
    siteUrl: getSiteUrl(locale),
  })
  cachedTransporter ??= nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true,
  })
  await cachedTransporter.sendMail({
    from: config.from,
    replyTo: config.replyTo,
    to: args.order.customerEmail.trim(),
    // Stable across retries; SMTP cannot guarantee exactly-once delivery.
    messageId: `<order-${args.deliveryId}@gerdan.online>`,
    ...message,
  })
}
