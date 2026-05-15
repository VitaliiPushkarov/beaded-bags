import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function normalizePath(value: string): string {
  if (!value) return '/api/telegram/production/webhook'
  return value.startsWith('/') ? value : `/${value}`
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function parseMaxConnectionsEnv(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value.trim(), 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return null
  return parsed
}

async function callTelegram(token: string, method: string, payload: object) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const json = (await response.json().catch(() => null)) as
    | { ok?: boolean; description?: string; result?: unknown }
    | null

  if (!response.ok || !json?.ok) {
    const description = json?.description ?? 'Unknown telegram API error'
    throw new Error(`${method} failed: ${description}`)
  }

  return json.result
}

async function main() {
  const token = process.env.TELEGRAM_PRODUCTION_BOT_TOKEN?.trim()
  const baseUrl = process.env.TELEGRAM_WEBHOOK_BASE_URL?.trim()
  const webhookPath = normalizePath(
    process.env.TELEGRAM_WEBHOOK_PATH?.trim() || '/api/telegram/production/webhook',
  )
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  const dropPendingUpdates = parseBooleanEnv(
    process.env.TELEGRAM_WEBHOOK_DROP_PENDING_UPDATES,
    false,
  )
  const maxConnections = parseMaxConnectionsEnv(
    process.env.TELEGRAM_WEBHOOK_MAX_CONNECTIONS,
  )

  if (!token) {
    throw new Error('Missing TELEGRAM_PRODUCTION_BOT_TOKEN')
  }

  if (!baseUrl) {
    throw new Error('Missing TELEGRAM_WEBHOOK_BASE_URL')
  }

  const webhookUrl = `${normalizeBaseUrl(baseUrl)}${webhookPath}`

  const setWebhookPayload: Record<string, unknown> = {
    url: webhookUrl,
    drop_pending_updates: dropPendingUpdates,
  }

  if (secretToken) {
    setWebhookPayload.secret_token = secretToken
  }

  if (typeof maxConnections === 'number') {
    setWebhookPayload.max_connections = maxConnections
  }

  await callTelegram(token, 'setWebhook', setWebhookPayload)
  const webhookInfo = await callTelegram(token, 'getWebhookInfo', {})

  console.info('Webhook is configured successfully')
  console.info(JSON.stringify({ webhookUrl, webhookInfo }, null, 2))
}

main().catch((error) => {
  console.error('[telegram:set-webhook] failed')
  console.error(error)
  process.exit(1)
})
