import { NextRequest, NextResponse } from 'next/server'

import {
  handleTelegramProductionUpdate,
  type TelegramUpdate,
} from '@/lib/telegram-production-bot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TelegramUpdateLike = {
  update_id?: unknown
}

function hasValidWebhookSecret(req: NextRequest): boolean {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (!expectedSecret) return true

  const actualSecret = req.headers.get('x-telegram-bot-api-secret-token')?.trim()
  return actualSecret === expectedSecret
}

function getProductionBotToken(): string | null {
  const token =
    process.env.TELEGRAM_PRODUCTION_BOT_TOKEN?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim()
  return token || null
}

function isTelegramUpdatePayload(value: unknown): value is { update_id: number } {
  if (!value || typeof value !== 'object') return false
  const candidate = value as TelegramUpdateLike
  return Number.isInteger(candidate.update_id)
}

export async function GET() {
  const token = getProductionBotToken()
  return NextResponse.json({
    ok: true,
    feature: 'telegram-production-bot-webhook',
    hasBotToken: Boolean(token),
    hasWebhookSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
    hasOwnerUsers: Boolean(process.env.TELEGRAM_OWNER_USER_IDS),
    usingDedicatedProductionBotToken: Boolean(
      process.env.TELEGRAM_PRODUCTION_BOT_TOKEN,
    ),
  })
}

export async function POST(req: NextRequest) {
  if (!getProductionBotToken()) {
    console.error(
      '[telegram-production] TELEGRAM_PRODUCTION_BOT_TOKEN/TELEGRAM_BOT_TOKEN is not configured',
    )
    return NextResponse.json(
      { ok: false, error: 'Production bot token is not configured' },
      { status: 500 },
    )
  }

  if (!hasValidWebhookSecret(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isTelegramUpdatePayload(payload)) {
    return NextResponse.json({ ok: false, error: 'Invalid update payload' }, { status: 400 })
  }

  try {
    await handleTelegramProductionUpdate(payload as TelegramUpdate)
  } catch (error) {
    console.error('[telegram-production] webhook processing failed', error)
    // We deliberately return 200 to avoid aggressive Telegram retries on persistent errors.
  }

  return NextResponse.json({ ok: true })
}
