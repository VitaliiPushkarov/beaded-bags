function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function normalizePath(value: string): string {
  if (!value) return '/api/telegram/production/webhook'
  return value.startsWith('/') ? value : `/${value}`
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
  const token =
    process.env.TELEGRAM_PRODUCTION_BOT_TOKEN?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim()
  const baseUrl = process.env.TELEGRAM_WEBHOOK_BASE_URL?.trim()
  const webhookPath = normalizePath(
    process.env.TELEGRAM_WEBHOOK_PATH?.trim() || '/api/telegram/production/webhook',
  )
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()

  if (!token) {
    throw new Error(
      'Missing TELEGRAM_PRODUCTION_BOT_TOKEN (or TELEGRAM_BOT_TOKEN fallback)',
    )
  }

  if (!baseUrl) {
    throw new Error('Missing TELEGRAM_WEBHOOK_BASE_URL')
  }

  const webhookUrl = `${normalizeBaseUrl(baseUrl)}${webhookPath}`

  const setWebhookPayload: Record<string, unknown> = {
    url: webhookUrl,
    drop_pending_updates: false,
  }

  if (secretToken) {
    setWebhookPayload.secret_token = secretToken
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
