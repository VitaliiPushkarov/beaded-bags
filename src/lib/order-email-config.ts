import { ORDER_EMAIL_ADDRESS } from './order-email-copy'

export function areOrderEmailsEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const explicit = env.ORDER_EMAILS_ENABLED?.trim().toLowerCase()
  if (explicit) return explicit === 'true' || explicit === '1'
  // Production is automatic; development and preview deployments opt in.
  return env.VERCEL_ENV
    ? env.VERCEL_ENV === 'production'
    : env.NODE_ENV === 'production'
}

export function readOrderSmtpConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const host = env.SMTP_HOST?.trim() || 'smtp.gmail.com'
  const user = env.SMTP_USER?.trim() || ORDER_EMAIL_ADDRESS
  const rawPassword = env.SMTP_PASSWORD?.trim()
  if (!rawPassword) return null
  const port = Number(env.SMTP_PORT?.trim() || 465)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  const secureRaw = env.SMTP_SECURE?.trim().toLowerCase()
  return {
    host,
    port,
    secure: secureRaw
      ? secureRaw === 'true' || secureRaw === '1'
      : port === 465,
    user,
    password:
      host === 'smtp.gmail.com' ? rawPassword.replace(/\s/g, '') : rawPassword,
    from: env.MAIL_FROM?.trim() || `GERDAN <${user}>`,
    replyTo: env.MAIL_REPLY_TO?.trim() || ORDER_EMAIL_ADDRESS,
  }
}
