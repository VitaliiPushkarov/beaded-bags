import { ExpenseCategory, Prisma, TelegramBotSessionStep } from '@prisma/client'

import { prisma } from '@/lib/prisma'

type TelegramUser = {
  id: number
  is_bot?: boolean
  first_name?: string
  username?: string
}

type TelegramChat = {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel'
}

type TelegramMessage = {
  message_id: number
  date: number
  chat: TelegramChat
  from?: TelegramUser
  text?: string
}

type TelegramCallbackQuery = {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  data?: string
}

export type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

type TelegramInlineKeyboardButton = {
  text: string
  callback_data: string
}

type TelegramReplyKeyboardButton = {
  text: string
}

type TelegramSendMessageInput = {
  chatId: string
  text: string
  inlineKeyboard?: TelegramInlineKeyboardButton[][]
  replyKeyboard?: TelegramReplyKeyboardButton[][]
}

type AdminFlowStage =
  | 'SELECT_ARTISAN'
  | 'SELECT_ITEM_TYPE'
  | 'AWAIT_ITEM_LABEL'
  | 'AWAIT_QTY'
  | 'AWAIT_RATE'
  | 'AWAIT_SETTLED'
  | 'AWAIT_NOTE'
  | 'REVIEW'
  | 'SELECT_SETTLE_ARTISAN'
  | 'SELECT_SETTLE_RECORD'
  | 'AWAIT_SETTLE_AMOUNT'
  | 'AWAIT_SETTLE_NOTE'
  | 'REVIEW_SETTLE'

type AdminDraft = {
  stage?: AdminFlowStage
  artisanId?: string
  artisanName?: string
  itemType?: 'CUSTOM_ITEM' | 'CATALOG_VARIANT'
  itemLabel?: string
  qty?: number
  ratePerUnitUAH?: number
  settledAmountUAH?: number
  notes?: string

  settleProductionId?: string
  settleProductionLabel?: string
  settleRemainingDebtUAH?: number
  settleAmountUAH?: number
  settleNotes?: string
}

type DebtProductionRow = {
  id: string
  artisanId: string
  artisanName: string
  itemLabel: string
  producedAt: Date
  totalLaborUAH: number
  settledAmountUAH: number
  remainingDebtUAH: number
}

type TelegramUpdateLike = {
  update_id?: unknown
}

const TELEGRAM_API_TIMEOUT_MS = 4500
const CALLBACK_PREFIX = 'adm'
const MAX_PICKER_ARTISANS = 60
const MAX_PICKER_RECORDS = 50

const MENU_BUTTONS = {
  newRecord: '➕ Новий запис',
  settleDebt: '💸 Відшкодувати борг',
  report: '📊 Звіт',
  help: '❓ Допомога',
  cancel: '❌ Скасувати',
} as const

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function formatUAH(amount: number): string {
  return `${Math.round(amount).toLocaleString('uk-UA')} ₴`
}

function formatDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  return formatter.format(date)
}

function toTelegramId(value: number | string): string {
  return String(value)
}

function parseInteger(input: string): number | null {
  const normalized = input.replace(/\s+/g, '')
  if (!/^-?\d+$/.test(normalized)) return null
  const parsed = Number(normalized)
  if (!Number.isInteger(parsed)) return null
  return parsed
}

function getBotToken(): string | null {
  const token = process.env.TELEGRAM_PRODUCTION_BOT_TOKEN?.trim()
  return token || null
}

function getAdminUserIds(): Set<string> {
  const raw = process.env.TELEGRAM_PRODUCTION_ADMIN_USER_IDS?.trim() || ''
  const ids = raw
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  return new Set(ids)
}

function isAllowedAdmin(userId: string): boolean {
  const ids = getAdminUserIds()
  if (ids.size === 0) {
    console.warn(
      '[telegram-production] TELEGRAM_PRODUCTION_ADMIN_USER_IDS is empty, admin bot access is disabled',
    )
    return false
  }
  return ids.has(userId)
}

function parseCommand(text: string): { command: string; args: string } | null {
  if (!text.startsWith('/')) return null

  const trimmed = text.trim()
  const firstSpace = trimmed.indexOf(' ')
  const commandPart = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)
  const args = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1).trim()

  const command = commandPart.slice(1).split('@')[0]?.trim().toLowerCase() || ''
  if (!command) return null

  return { command, args }
}

function normalizeCommand(command: string): string {
  const normalized = command.trim().toLowerCase()
  const aliases: Record<string, string> = {
    start: 'start',
    help: 'help',
    new: 'new',
    record: 'new',
    report: 'report',
    settle: 'settle',
    cancel: 'cancel',
    stop: 'cancel',

    допомога: 'help',
    запис: 'new',
    звіт: 'report',
    борг: 'settle',
    скасувати: 'cancel',
  }

  return aliases[normalized] ?? normalized
}

function mapMenuButtonToCommand(text: string): string | null {
  if (text === MENU_BUTTONS.newRecord) return 'new'
  if (text === MENU_BUTTONS.settleDebt) return 'settle'
  if (text === MENU_BUTTONS.report) return 'report'
  if (text === MENU_BUTTONS.help) return 'help'
  if (text === MENU_BUTTONS.cancel) return 'cancel'
  return null
}

function buildMainMenuKeyboard(): TelegramReplyKeyboardButton[][] {
  return [
    [{ text: MENU_BUTTONS.newRecord }, { text: MENU_BUTTONS.settleDebt }],
    [{ text: MENU_BUTTONS.report }, { text: MENU_BUTTONS.help }],
    [{ text: MENU_BUTTONS.cancel }],
  ]
}

function buildHelpText() {
  return [
    '<b>Production Bot (адмін)</b>',
    '',
    'Команди:',
    '/new - новий запис виробітку',
    '/settle - відшкодувати борг по запису',
    '/report - звіт по майстрах (відшкодовано / борг)',
    '/cancel - скасувати поточний ввід',
    '',
    'Новий запис:',
    'майстер → тип товару → назва → к-сть → ставка → відшкодовано → зберегти',
  ].join('\n')
}

function isTelegramUpdatePayload(value: unknown): value is { update_id: number } {
  if (!value || typeof value !== 'object') return false
  const candidate = value as TelegramUpdateLike
  return Number.isInteger(candidate.update_id)
}

function parseAdminDraft(draftPayload: Prisma.JsonValue | null): AdminDraft {
  if (
    !draftPayload ||
    typeof draftPayload !== 'object' ||
    Array.isArray(draftPayload)
  ) {
    return {}
  }

  const raw = draftPayload as Record<string, unknown>
  const next: AdminDraft = {}

  if (
    raw.stage === 'SELECT_ARTISAN' ||
    raw.stage === 'SELECT_ITEM_TYPE' ||
    raw.stage === 'AWAIT_ITEM_LABEL' ||
    raw.stage === 'AWAIT_QTY' ||
    raw.stage === 'AWAIT_RATE' ||
    raw.stage === 'AWAIT_SETTLED' ||
    raw.stage === 'AWAIT_NOTE' ||
    raw.stage === 'REVIEW' ||
    raw.stage === 'SELECT_SETTLE_ARTISAN' ||
    raw.stage === 'SELECT_SETTLE_RECORD' ||
    raw.stage === 'AWAIT_SETTLE_AMOUNT' ||
    raw.stage === 'AWAIT_SETTLE_NOTE' ||
    raw.stage === 'REVIEW_SETTLE'
  ) {
    next.stage = raw.stage
  }

  if (typeof raw.artisanId === 'string' && raw.artisanId.trim()) {
    next.artisanId = raw.artisanId.trim()
  }

  if (typeof raw.artisanName === 'string' && raw.artisanName.trim()) {
    next.artisanName = raw.artisanName.trim()
  }

  if (raw.itemType === 'CUSTOM_ITEM' || raw.itemType === 'CATALOG_VARIANT') {
    next.itemType = raw.itemType
  }

  if (typeof raw.itemLabel === 'string' && raw.itemLabel.trim()) {
    next.itemLabel = raw.itemLabel.trim()
  }

  if (typeof raw.qty === 'number' && Number.isInteger(raw.qty) && raw.qty > 0) {
    next.qty = raw.qty
  }

  if (
    typeof raw.ratePerUnitUAH === 'number' &&
    Number.isInteger(raw.ratePerUnitUAH) &&
    raw.ratePerUnitUAH > 0
  ) {
    next.ratePerUnitUAH = raw.ratePerUnitUAH
  }

  if (
    typeof raw.settledAmountUAH === 'number' &&
    Number.isInteger(raw.settledAmountUAH) &&
    raw.settledAmountUAH >= 0
  ) {
    next.settledAmountUAH = raw.settledAmountUAH
  }

  if (typeof raw.notes === 'string') {
    next.notes = raw.notes
  }

  if (typeof raw.settleProductionId === 'string' && raw.settleProductionId.trim()) {
    next.settleProductionId = raw.settleProductionId.trim()
  }

  if (
    typeof raw.settleProductionLabel === 'string' &&
    raw.settleProductionLabel.trim()
  ) {
    next.settleProductionLabel = raw.settleProductionLabel.trim()
  }

  if (
    typeof raw.settleRemainingDebtUAH === 'number' &&
    Number.isInteger(raw.settleRemainingDebtUAH) &&
    raw.settleRemainingDebtUAH >= 0
  ) {
    next.settleRemainingDebtUAH = raw.settleRemainingDebtUAH
  }

  if (
    typeof raw.settleAmountUAH === 'number' &&
    Number.isInteger(raw.settleAmountUAH) &&
    raw.settleAmountUAH > 0
  ) {
    next.settleAmountUAH = raw.settleAmountUAH
  }

  if (typeof raw.settleNotes === 'string') {
    next.settleNotes = raw.settleNotes
  }

  return next
}

function buildAdminDraftJson(draft: AdminDraft): Prisma.JsonObject {
  const payload: Prisma.JsonObject = {}
  if (draft.stage) payload.stage = draft.stage
  if (draft.artisanId) payload.artisanId = draft.artisanId
  if (draft.artisanName) payload.artisanName = draft.artisanName
  if (draft.itemType) payload.itemType = draft.itemType
  if (draft.itemLabel) payload.itemLabel = draft.itemLabel
  if (typeof draft.qty === 'number') payload.qty = draft.qty
  if (typeof draft.ratePerUnitUAH === 'number') {
    payload.ratePerUnitUAH = draft.ratePerUnitUAH
  }
  if (typeof draft.settledAmountUAH === 'number') {
    payload.settledAmountUAH = draft.settledAmountUAH
  }
  if (typeof draft.notes === 'string') payload.notes = draft.notes

  if (draft.settleProductionId) payload.settleProductionId = draft.settleProductionId
  if (draft.settleProductionLabel) {
    payload.settleProductionLabel = draft.settleProductionLabel
  }
  if (typeof draft.settleRemainingDebtUAH === 'number') {
    payload.settleRemainingDebtUAH = draft.settleRemainingDebtUAH
  }
  if (typeof draft.settleAmountUAH === 'number') {
    payload.settleAmountUAH = draft.settleAmountUAH
  }
  if (typeof draft.settleNotes === 'string') payload.settleNotes = draft.settleNotes

  return payload
}

function buildSessionKey(input: {
  chatId: string
  userId: string
  chatType: TelegramChat['type']
}): string {
  if (input.chatType === 'private') {
    return `p:${input.chatId}`
  }

  return `g:${input.chatId}:u:${input.userId}`
}

async function setSession(input: {
  sessionKey: string
  userId: string
  draft: AdminDraft
}): Promise<void> {
  await prisma.telegramBotSession.upsert({
    where: { chatId: input.sessionKey },
    create: {
      chatId: input.sessionKey,
      userId: input.userId,
      step: TelegramBotSessionStep.AWAITING_CONFIRM,
      draftPayload: buildAdminDraftJson(input.draft),
    },
    update: {
      userId: input.userId,
      step: TelegramBotSessionStep.AWAITING_CONFIRM,
      draftPayload: buildAdminDraftJson(input.draft),
    },
  })
}

async function getSession(sessionKey: string) {
  return prisma.telegramBotSession.findUnique({ where: { chatId: sessionKey } })
}

async function clearSession(sessionKey: string): Promise<void> {
  await prisma.telegramBotSession.deleteMany({ where: { chatId: sessionKey } })
}

async function callTelegramApi<T = unknown>(
  method: string,
  payload: object,
): Promise<T | null> {
  const token = getBotToken()
  if (!token) {
    console.warn(
      '[telegram-production] TELEGRAM_PRODUCTION_BOT_TOKEN is not configured',
    )
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_API_TIMEOUT_MS)

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    )

    const json = (await response.json().catch(() => null)) as {
      ok?: boolean
      result?: T
      description?: string
    } | null

    if (!response.ok || !json?.ok) {
      console.error(
        '[telegram-production] telegram API failed',
        method,
        response.status,
        json?.description ?? 'Unknown telegram error',
      )
      return null
    }

    return (json.result ?? null) as T | null
  } catch (error) {
    console.error('[telegram-production] telegram API error', method, error)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function sendTelegramMessage(
  input: TelegramSendMessageInput,
): Promise<void> {
  const payload: Record<string, unknown> = {
    chat_id: input.chatId,
    text: input.text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }

  if (input.inlineKeyboard && input.inlineKeyboard.length > 0) {
    payload.reply_markup = {
      inline_keyboard: input.inlineKeyboard,
    }
  } else if (input.replyKeyboard && input.replyKeyboard.length > 0) {
    payload.reply_markup = {
      keyboard: input.replyKeyboard,
      resize_keyboard: true,
      is_persistent: true,
    }
  }

  await callTelegramApi('sendMessage', payload)
}

async function answerCallbackQuery(input: {
  callbackQueryId: string
  text?: string
  showAlert?: boolean
}): Promise<void> {
  await callTelegramApi('answerCallbackQuery', {
    callback_query_id: input.callbackQueryId,
    text: input.text,
    show_alert: input.showAlert ?? false,
  })
}

async function listDebtProductions(): Promise<DebtProductionRow[]> {
  const rows = await prisma.adminProduction.findMany({
    include: {
      artisan: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ producedAt: 'asc' }, { createdAt: 'asc' }],
    take: 2000,
  })

  return rows
    .map((row) => ({
      id: row.id,
      artisanId: row.artisanId,
      artisanName: row.artisan.name,
      itemLabel: row.itemLabel,
      producedAt: row.producedAt,
      totalLaborUAH: row.totalLaborUAH,
      settledAmountUAH: row.settledAmountUAH,
      remainingDebtUAH: Math.max(0, row.totalLaborUAH - row.settledAmountUAH),
    }))
    .filter((row) => row.remainingDebtUAH > 0)
}

function getDraftSummaryLines(draft: AdminDraft): string[] {
  const qty = draft.qty ?? 0
  const rate = draft.ratePerUnitUAH ?? 0
  const total = qty * rate
  const settled = draft.settledAmountUAH ?? 0
  const debt = Math.max(0, total - settled)

  return [
    '<b>Перевір запис перед збереженням</b>',
    `Майстер: <b>${escapeHtml(draft.artisanName ?? '—')}</b>`,
    `Тип: ${draft.itemType === 'CATALOG_VARIANT' ? 'Каталог' : 'Унікальний'}`,
    `Товар: ${escapeHtml(draft.itemLabel ?? '—')}`,
    `К-сть: <b>${qty}</b>`,
    `Ставка: <b>${formatUAH(rate)}</b>`,
    `Нараховано: <b>${formatUAH(total)}</b>`,
    `Відшкодовано: <b>${formatUAH(settled)}</b>`,
    `Борг: <b>${formatUAH(debt)}</b>`,
    draft.notes ? `Примітка: ${escapeHtml(draft.notes)}` : 'Примітка: —',
  ]
}

function getSettleSummaryLines(draft: AdminDraft): string[] {
  const amount = draft.settleAmountUAH ?? 0
  const remainingBefore = draft.settleRemainingDebtUAH ?? 0
  const remainingAfter = Math.max(0, remainingBefore - amount)

  return [
    '<b>Підтвердження відшкодування</b>',
    `Майстер: <b>${escapeHtml(draft.artisanName ?? '—')}</b>`,
    `Запис: ${escapeHtml(draft.settleProductionLabel ?? '—')}`,
    `Борг до: <b>${formatUAH(remainingBefore)}</b>`,
    `Сума відшкодування: <b>${formatUAH(amount)}</b>`,
    `Борг після: <b>${formatUAH(remainingAfter)}</b>`,
    draft.settleNotes
      ? `Примітка: ${escapeHtml(draft.settleNotes)}`
      : 'Примітка: —',
  ]
}

function buildReportText(rows: Array<{
  artisanName: string
  entries: number
  qty: number
  totalLabor: number
  settled: number
}>): string {
  if (rows.length === 0) {
    return 'Ще немає записів у виробництві.'
  }

  const sorted = [...rows].sort((a, b) => {
    const debtA = a.totalLabor - a.settled
    const debtB = b.totalLabor - b.settled
    return debtB - debtA
  })

  const totalLabor = sorted.reduce((sum, row) => sum + row.totalLabor, 0)
  const totalSettled = sorted.reduce((sum, row) => sum + row.settled, 0)
  const totalDebt = totalLabor - totalSettled

  const lines = ['<b>Звіт по майстрах</b>', '']

  sorted.slice(0, 40).forEach((row, index) => {
    const debt = Math.max(0, row.totalLabor - row.settled)
    lines.push(
      `${index + 1}. <b>${escapeHtml(row.artisanName)}</b>`,
      `• записів: ${row.entries}, шт: ${row.qty}`,
      `• нараховано: ${formatUAH(row.totalLabor)}`,
      `• відшкодовано: ${formatUAH(row.settled)}`,
      `• борг: ${formatUAH(debt)}`,
      '',
    )
  })

  if (sorted.length > 40) {
    lines.push(`...ще ${sorted.length - 40} майстрів не показано`)
    lines.push('')
  }

  lines.push('<b>Разом</b>')
  lines.push(`Нараховано: ${formatUAH(totalLabor)}`)
  lines.push(`Відшкодовано: ${formatUAH(totalSettled)}`)
  lines.push(`Борг: ${formatUAH(Math.max(0, totalDebt))}`)

  return lines.join('\n')
}

async function sendArtisanPicker(chatId: string): Promise<void> {
  const artisans = await prisma.artisan.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: MAX_PICKER_ARTISANS,
  })

  if (artisans.length === 0) {
    await sendTelegramMessage({
      chatId,
      text: 'Немає активних майстрів. Додай майстра в адмінці.',
      replyKeyboard: buildMainMenuKeyboard(),
    })
    return
  }

  const rows: TelegramInlineKeyboardButton[][] = artisans.map((artisan) => [
    {
      text: artisan.name,
      callback_data: `${CALLBACK_PREFIX}:artisan:${artisan.id}`,
    },
  ])

  rows.push([{ text: '❌ Скасувати', callback_data: `${CALLBACK_PREFIX}:cancel` }])

  await sendTelegramMessage({
    chatId,
    text: [
      '<b>Новий запис виробітку</b>',
      'Крок 1/6: Обери майстра.',
      artisans.length >= MAX_PICKER_ARTISANS
        ? `Показано перші ${MAX_PICKER_ARTISANS} майстрів за алфавітом.`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
    inlineKeyboard: rows,
  })
}

async function sendDebtArtisanPicker(input: {
  chatId: string
  userId: string
  sessionKey: string
}) {
  const debtRows = await listDebtProductions()

  if (debtRows.length === 0) {
    await clearSession(input.sessionKey)
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Боргу по записах немає.',
      replyKeyboard: buildMainMenuKeyboard(),
    })
    return
  }

  const byArtisan = new Map<
    string,
    { artisanName: string; debtUAH: number; entries: number }
  >()

  for (const row of debtRows) {
    const current = byArtisan.get(row.artisanId)
    if (current) {
      current.debtUAH += row.remainingDebtUAH
      current.entries += 1
      continue
    }
    byArtisan.set(row.artisanId, {
      artisanName: row.artisanName,
      debtUAH: row.remainingDebtUAH,
      entries: 1,
    })
  }

  const sorted = Array.from(byArtisan.entries())
    .map(([artisanId, value]) => ({ artisanId, ...value }))
    .sort((a, b) => b.debtUAH - a.debtUAH)
    .slice(0, MAX_PICKER_ARTISANS)

  await setSession({
    sessionKey: input.sessionKey,
    userId: input.userId,
    draft: {
      stage: 'SELECT_SETTLE_ARTISAN',
    },
  })

  const rows: TelegramInlineKeyboardButton[][] = sorted.map((entry) => [
    {
      text: `${entry.artisanName} • борг ${formatUAH(entry.debtUAH)} (${entry.entries})`,
      callback_data: `${CALLBACK_PREFIX}:settle_artisan:${entry.artisanId}`,
    },
  ])
  rows.push([{ text: '❌ Скасувати', callback_data: `${CALLBACK_PREFIX}:cancel` }])

  await sendTelegramMessage({
    chatId: input.chatId,
    text: '<b>Відшкодування боргу</b>\nКрок 1/3: Обери майстра.',
    inlineKeyboard: rows,
  })
}

async function beginNewRecordFlow(input: {
  chatId: string
  userId: string
  sessionKey: string
}) {
  await setSession({
    sessionKey: input.sessionKey,
    userId: input.userId,
    draft: { stage: 'SELECT_ARTISAN' },
  })

  await sendArtisanPicker(input.chatId)
}

async function sendItemTypePicker(input: {
  chatId: string
  userId: string
  sessionKey: string
  draft: AdminDraft
}) {
  await setSession({
    sessionKey: input.sessionKey,
    userId: input.userId,
    draft: {
      ...input.draft,
      stage: 'SELECT_ITEM_TYPE',
    },
  })

  await sendTelegramMessage({
    chatId: input.chatId,
    text: [
      `<b>Майстер:</b> ${escapeHtml(input.draft.artisanName ?? '—')}`,
      'Крок 2/6: Обери тип товару.',
    ].join('\n'),
    inlineKeyboard: [
      [
        {
          text: '📦 Товар з каталогу',
          callback_data: `${CALLBACK_PREFIX}:itype:catalog`,
        },
      ],
      [
        {
          text: '🧷 Унікальний товар',
          callback_data: `${CALLBACK_PREFIX}:itype:custom`,
        },
      ],
      [{ text: '❌ Скасувати', callback_data: `${CALLBACK_PREFIX}:cancel` }],
    ],
  })
}

async function sendSettleRecordPicker(input: {
  chatId: string
  userId: string
  sessionKey: string
  artisanId: string
  artisanName: string
}) {
  const debtRows = (await listDebtProductions())
    .filter((row) => row.artisanId === input.artisanId)
    .slice(0, MAX_PICKER_RECORDS)

  if (debtRows.length === 0) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'У цього майстра немає активного боргу. Обери іншого.',
    })

    await sendDebtArtisanPicker({
      chatId: input.chatId,
      userId: input.userId,
      sessionKey: input.sessionKey,
    })
    return
  }

  await setSession({
    sessionKey: input.sessionKey,
    userId: input.userId,
    draft: {
      stage: 'SELECT_SETTLE_RECORD',
      artisanId: input.artisanId,
      artisanName: input.artisanName,
    },
  })

  const rows: TelegramInlineKeyboardButton[][] = debtRows.map((row) => [
    {
      text: `${formatDate(row.producedAt)} • ${row.itemLabel.slice(0, 36)} • ${formatUAH(row.remainingDebtUAH)}`,
      callback_data: `${CALLBACK_PREFIX}:settle_record:${row.id}`,
    },
  ])
  rows.push([{ text: '❌ Скасувати', callback_data: `${CALLBACK_PREFIX}:cancel` }])

  await sendTelegramMessage({
    chatId: input.chatId,
    text: [
      `<b>Майстер:</b> ${escapeHtml(input.artisanName)}`,
      'Крок 2/3: Обери запис з боргом.',
    ].join('\n'),
    inlineKeyboard: rows,
  })
}

async function sendReview(input: {
  chatId: string
  userId: string
  sessionKey: string
  draft: AdminDraft
}) {
  await setSession({
    sessionKey: input.sessionKey,
    userId: input.userId,
    draft: {
      ...input.draft,
      stage: 'REVIEW',
    },
  })

  await sendTelegramMessage({
    chatId: input.chatId,
    text: getDraftSummaryLines(input.draft).join('\n'),
    inlineKeyboard: [
      [{ text: '✅ Зберегти', callback_data: `${CALLBACK_PREFIX}:save` }],
      [
        {
          text: '📝 Додати/змінити примітку',
          callback_data: `${CALLBACK_PREFIX}:note`,
        },
      ],
      [{ text: '❌ Скасувати', callback_data: `${CALLBACK_PREFIX}:cancel` }],
    ],
  })
}

async function sendSettleReview(input: {
  chatId: string
  userId: string
  sessionKey: string
  draft: AdminDraft
}) {
  await setSession({
    sessionKey: input.sessionKey,
    userId: input.userId,
    draft: {
      ...input.draft,
      stage: 'REVIEW_SETTLE',
    },
  })

  await sendTelegramMessage({
    chatId: input.chatId,
    text: getSettleSummaryLines(input.draft).join('\n'),
    inlineKeyboard: [
      [
        {
          text: '✅ Підтвердити відшкодування',
          callback_data: `${CALLBACK_PREFIX}:save_settle`,
        },
      ],
      [
        {
          text: '📝 Змінити примітку',
          callback_data: `${CALLBACK_PREFIX}:settle_note`,
        },
      ],
      [{ text: '❌ Скасувати', callback_data: `${CALLBACK_PREFIX}:cancel` }],
    ],
  })
}

async function saveAdminProduction(input: {
  callbackQueryId: string
  chatId: string
  userId: string
  sessionKey: string
  draft: AdminDraft
}): Promise<void> {
  const { draft } = input

  if (
    !draft.artisanId ||
    !draft.artisanName ||
    !draft.itemType ||
    !draft.itemLabel ||
    !draft.qty ||
    !draft.ratePerUnitUAH ||
    typeof draft.settledAmountUAH !== 'number'
  ) {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Чернетка неповна. Почни заново.',
      showAlert: true,
    })
    await clearSession(input.sessionKey)
    return
  }

  const artisanId = draft.artisanId
  const artisanName = draft.artisanName
  const itemType = draft.itemType
  const itemLabel = draft.itemLabel
  const qty = draft.qty
  const ratePerUnitUAH = draft.ratePerUnitUAH
  const settledAmountUAH = draft.settledAmountUAH
  const totalLaborUAH = qty * ratePerUnitUAH

  if (settledAmountUAH > totalLaborUAH) {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Відшкодовано не може бути більше нарахованого',
      showAlert: true,
    })
    return
  }

  const result = await prisma.$transaction(async (tx) => {
    let expenseId: string | null = null

    if (settledAmountUAH > 0) {
      const expense = await tx.expense.create({
        data: {
          title: `${artisanName}: ${itemLabel}, ${qty} шт, ${ratePerUnitUAH}₴/шт`,
          category: ExpenseCategory.PAYROLL,
          amountUAH: settledAmountUAH,
          expenseDate: new Date(),
          notes: [
            'Оплата роботи майстра (admin production bot, initial)',
            `artisanId=${artisanId}`,
            `itemType=${itemType}`,
            `itemLabel=${itemLabel}`,
            `qty=${qty}`,
            `rate=${ratePerUnitUAH}`,
            `total=${totalLaborUAH}`,
            `settled=${settledAmountUAH}`,
            draft.notes ? `notes=${draft.notes}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      })
      expenseId = expense.id
    }

    const production = await tx.adminProduction.create({
      data: {
        artisanId,
        itemType,
        itemLabel,
        qty,
        ratePerUnitUAH,
        totalLaborUAH,
        settledAmountUAH,
        notes: draft.notes?.trim() || null,
        createdByTelegramUserId: input.userId,
        createdByTelegramChatId: input.chatId,
        paidExpenseId: expenseId,
      },
      select: {
        id: true,
        totalLaborUAH: true,
        settledAmountUAH: true,
      },
    })

    if (settledAmountUAH > 0 && expenseId) {
      await tx.adminProduction.update({
        where: { id: production.id },
        data: {
          settlements: {
            create: {
              amountUAH: settledAmountUAH,
              notes: draft.notes?.trim() || null,
              createdByTelegramUserId: input.userId,
              createdByTelegramChatId: input.chatId,
              expenseId,
            },
          },
        },
      })
    }

    return production
  })

  await clearSession(input.sessionKey)

  await answerCallbackQuery({
    callbackQueryId: input.callbackQueryId,
    text: 'Запис збережено',
  })

  const debt = Math.max(0, result.totalLaborUAH - result.settledAmountUAH)

  await sendTelegramMessage({
    chatId: input.chatId,
    text: [
      '✅ Запис виробітку збережено.',
      `ID: <code>${escapeHtml(result.id)}</code>`,
      `Нараховано: <b>${formatUAH(result.totalLaborUAH)}</b>`,
      `Відшкодовано: <b>${formatUAH(result.settledAmountUAH)}</b>`,
      `Борг: <b>${formatUAH(debt)}</b>`,
    ].join('\n'),
    replyKeyboard: buildMainMenuKeyboard(),
  })
}

async function saveDebtSettlement(input: {
  callbackQueryId: string
  chatId: string
  userId: string
  sessionKey: string
  draft: AdminDraft
}) {
  const productionId = input.draft.settleProductionId?.trim()
  const amountUAH = input.draft.settleAmountUAH

  if (!productionId || !amountUAH || amountUAH <= 0) {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Чернетка відшкодування неповна.',
      showAlert: true,
    })
    return
  }

  const result = await prisma.$transaction(async (tx) => {
    const production = await tx.adminProduction.findUnique({
      where: { id: productionId },
      include: {
        artisan: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!production) {
      throw new Error('NOT_FOUND')
    }

    const remaining = Math.max(0, production.totalLaborUAH - production.settledAmountUAH)
    if (remaining <= 0) {
      throw new Error('NO_DEBT')
    }

    if (amountUAH > remaining) {
      throw new Error('OVERPAY')
    }

    const expense = await tx.expense.create({
      data: {
        title: `${production.artisan.name}: ${production.itemLabel}, погашення боргу`,
        category: ExpenseCategory.PAYROLL,
        amountUAH,
        expenseDate: new Date(),
        notes: [
          'Оплата боргу майстра (admin production bot)',
          `adminProductionId=${production.id}`,
          `artisanId=${production.artisanId}`,
          `itemLabel=${production.itemLabel}`,
          `beforeSettled=${production.settledAmountUAH}`,
          `payAmount=${amountUAH}`,
          `afterSettled=${production.settledAmountUAH + amountUAH}`,
          input.draft.settleNotes ? `notes=${input.draft.settleNotes}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    })

    const updated = await tx.adminProduction.update({
      where: { id: production.id },
      data: {
        settledAmountUAH: {
          increment: amountUAH,
        },
        paidExpenseId: expense.id,
        settlements: {
          create: {
            amountUAH,
            notes: input.draft.settleNotes?.trim() || null,
            createdByTelegramUserId: input.userId,
            createdByTelegramChatId: input.chatId,
            expenseId: expense.id,
          },
        },
      },
      select: {
        id: true,
        totalLaborUAH: true,
        settledAmountUAH: true,
      },
    })

    return updated
  }).catch((error) => {
    const message = error instanceof Error ? error.message : 'UNKNOWN'
    if (message === 'NOT_FOUND') return null
    if (message === 'NO_DEBT') return 'NO_DEBT' as const
    if (message === 'OVERPAY') return 'OVERPAY' as const
    throw error
  })

  if (result === null) {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Запис не знайдено',
      showAlert: true,
    })
    return
  }

  if (result === 'NO_DEBT') {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'У записі вже немає боргу',
      showAlert: true,
    })
    return
  }

  if (result === 'OVERPAY') {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Сума більше за поточний борг',
      showAlert: true,
    })
    return
  }

  await clearSession(input.sessionKey)

  await answerCallbackQuery({
    callbackQueryId: input.callbackQueryId,
    text: 'Відшкодування збережено',
  })

  const debt = Math.max(0, result.totalLaborUAH - result.settledAmountUAH)

  await sendTelegramMessage({
    chatId: input.chatId,
    text: [
      '✅ Відшкодування боргу збережено.',
      `Запис: <code>${escapeHtml(result.id)}</code>`,
      `Відшкодовано загалом: <b>${formatUAH(result.settledAmountUAH)}</b>`,
      `Залишок боргу: <b>${formatUAH(debt)}</b>`,
    ].join('\n'),
    replyKeyboard: buildMainMenuKeyboard(),
  })
}

async function sendReport(chatId: string): Promise<void> {
  const grouped = await prisma.adminProduction.groupBy({
    by: ['artisanId'],
    _sum: {
      totalLaborUAH: true,
      settledAmountUAH: true,
      qty: true,
    },
    _count: {
      _all: true,
    },
  })

  if (grouped.length === 0) {
    await sendTelegramMessage({
      chatId,
      text: 'Ще немає записів у виробництві.',
      replyKeyboard: buildMainMenuKeyboard(),
    })
    return
  }

  const artisans = await prisma.artisan.findMany({
    where: {
      id: { in: grouped.map((entry) => entry.artisanId) },
    },
    select: {
      id: true,
      name: true,
    },
  })

  const artisanNames = new Map(artisans.map((artisan) => [artisan.id, artisan.name]))

  const rows = grouped.map((entry) => ({
    artisanName: artisanNames.get(entry.artisanId) ?? entry.artisanId,
    entries: entry._count._all,
    qty: entry._sum.qty ?? 0,
    totalLabor: entry._sum.totalLaborUAH ?? 0,
    settled: entry._sum.settledAmountUAH ?? 0,
  }))

  await sendTelegramMessage({
    chatId,
    text: buildReportText(rows),
    replyKeyboard: buildMainMenuKeyboard(),
  })
}

async function handleDraftTextInput(input: {
  chatId: string
  chatType: TelegramChat['type']
  userId: string
  text: string
}) {
  const sessionKey = buildSessionKey({
    chatId: input.chatId,
    userId: input.userId,
    chatType: input.chatType,
  })

  const session = await getSession(sessionKey)
  if (!session) return

  const draft = parseAdminDraft(session.draftPayload)

  if (draft.stage === 'AWAIT_ITEM_LABEL') {
    const label = input.text.trim()
    if (label.length < 2 || label.length > 160) {
      await sendTelegramMessage({
        chatId: input.chatId,
        text: 'Введи назву товару від 2 до 160 символів.',
      })
      return
    }

    await setSession({
      sessionKey,
      userId: input.userId,
      draft: {
        ...draft,
        itemLabel: label,
        stage: 'AWAIT_QTY',
      },
    })

    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Крок 4/6: Введи кількість (ціле число, наприклад <code>12</code>).',
    })
    return
  }

  if (draft.stage === 'AWAIT_QTY') {
    const qty = parseInteger(input.text)
    if (!qty || qty < 1 || qty > 100000) {
      await sendTelegramMessage({
        chatId: input.chatId,
        text: 'Некоректна кількість. Введи ціле число від 1 до 100000.',
      })
      return
    }

    await setSession({
      sessionKey,
      userId: input.userId,
      draft: {
        ...draft,
        qty,
        stage: 'AWAIT_RATE',
      },
    })

    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Крок 5/6: Введи ставку за 1 шт у грн (ціле число).',
    })
    return
  }

  if (draft.stage === 'AWAIT_RATE') {
    const rate = parseInteger(input.text)
    if (!rate || rate < 1 || rate > 1000000) {
      await sendTelegramMessage({
        chatId: input.chatId,
        text: 'Некоректна ставка. Введи ціле число від 1 до 1000000.',
      })
      return
    }

    await setSession({
      sessionKey,
      userId: input.userId,
      draft: {
        ...draft,
        ratePerUnitUAH: rate,
        stage: 'AWAIT_SETTLED',
      },
    })

    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Крок 6/6: Введи, скільки відшкодовано зараз (можна <code>0</code>).',
    })
    return
  }

  if (draft.stage === 'AWAIT_SETTLED') {
    const settled = parseInteger(input.text)
    if (settled === null || settled < 0) {
      await sendTelegramMessage({
        chatId: input.chatId,
        text: 'Некоректна сума. Введи ціле число, наприклад <code>0</code> або <code>4500</code>.',
      })
      return
    }

    const total = (draft.qty ?? 0) * (draft.ratePerUnitUAH ?? 0)
    if (settled > total) {
      await sendTelegramMessage({
        chatId: input.chatId,
        text: `Відшкодовано не може бути більше нарахованого (${formatUAH(total)}).`,
      })
      return
    }

    await sendReview({
      chatId: input.chatId,
      userId: input.userId,
      sessionKey,
      draft: {
        ...draft,
        settledAmountUAH: settled,
      },
    })
    return
  }

  if (draft.stage === 'AWAIT_NOTE') {
    const notes = input.text.trim()

    await sendReview({
      chatId: input.chatId,
      userId: input.userId,
      sessionKey,
      draft: {
        ...draft,
        notes: notes === '-' ? '' : notes,
      },
    })
    return
  }

  if (draft.stage === 'AWAIT_SETTLE_AMOUNT') {
    const amount = parseInteger(input.text)
    const maxDebt = draft.settleRemainingDebtUAH ?? 0

    if (!amount || amount < 1) {
      await sendTelegramMessage({
        chatId: input.chatId,
        text: 'Введи суму відшкодування цілим числом більше 0.',
      })
      return
    }

    if (amount > maxDebt) {
      await sendTelegramMessage({
        chatId: input.chatId,
        text: `Сума не може бути більшою за борг (${formatUAH(maxDebt)}).`,
      })
      return
    }

    await setSession({
      sessionKey,
      userId: input.userId,
      draft: {
        ...draft,
        settleAmountUAH: amount,
        stage: 'AWAIT_SETTLE_NOTE',
      },
    })

    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Введи примітку для погашення або <code>-</code> щоб пропустити.',
    })
    return
  }

  if (draft.stage === 'AWAIT_SETTLE_NOTE') {
    const notes = input.text.trim()

    await sendSettleReview({
      chatId: input.chatId,
      userId: input.userId,
      sessionKey,
      draft: {
        ...draft,
        settleNotes: notes === '-' ? '' : notes,
      },
    })
    return
  }
}

async function handleCommand(input: {
  command: string
  chatId: string
  chatType: TelegramChat['type']
  userId: string
}) {
  const command = normalizeCommand(input.command)

  if (input.chatType !== 'private') {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Цей бот працює лише в приватному чаті.',
    })
    return
  }

  if (!isAllowedAdmin(input.userId)) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Доступ заборонено. Цей бот доступний лише адміністраторам.',
    })
    return
  }

  const sessionKey = buildSessionKey({
    chatId: input.chatId,
    userId: input.userId,
    chatType: input.chatType,
  })

  if (command === 'start' || command === 'help') {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: buildHelpText(),
      replyKeyboard: buildMainMenuKeyboard(),
    })
    return
  }

  if (command === 'new') {
    await beginNewRecordFlow({
      chatId: input.chatId,
      userId: input.userId,
      sessionKey,
    })
    return
  }

  if (command === 'settle') {
    await sendDebtArtisanPicker({
      chatId: input.chatId,
      userId: input.userId,
      sessionKey,
    })
    return
  }

  if (command === 'report') {
    await sendReport(input.chatId)
    return
  }

  if (command === 'cancel') {
    await clearSession(sessionKey)
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Поточний ввід скасовано.',
      replyKeyboard: buildMainMenuKeyboard(),
    })
    return
  }

  await sendTelegramMessage({
    chatId: input.chatId,
    text: 'Невідома команда. Використай /help.',
    replyKeyboard: buildMainMenuKeyboard(),
  })
}

async function handleCallbackQuery(callback: TelegramCallbackQuery) {
  const fromUserId = toTelegramId(callback.from.id)
  const callbackData = callback.data?.trim() || ''

  if (!callbackData.startsWith(`${CALLBACK_PREFIX}:`)) {
    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Невідома дія',
      showAlert: true,
    })
    return
  }

  const message = callback.message
  const chatId = message?.chat?.id ? toTelegramId(message.chat.id) : null
  const chatType = message?.chat?.type
  const sessionKey =
    chatId && chatType
      ? buildSessionKey({ chatId, userId: fromUserId, chatType })
      : null

  if (!chatId || !chatType || !sessionKey) {
    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Сесію не знайдено',
      showAlert: true,
    })
    return
  }

  if (!isAllowedAdmin(fromUserId)) {
    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Доступ заборонено',
      showAlert: true,
    })
    return
  }

  const parts = callbackData.split(':')
  const action = parts[1] ?? ''
  const arg1 = parts[2] ?? ''

  const session = await getSession(sessionKey)
  const draft = parseAdminDraft(session?.draftPayload ?? null)

  if (action === 'cancel') {
    await clearSession(sessionKey)
    await answerCallbackQuery({ callbackQueryId: callback.id, text: 'Скасовано' })
    await sendTelegramMessage({
      chatId,
      text: 'Ввід скасовано.',
      replyKeyboard: buildMainMenuKeyboard(),
    })
    return
  }

  if (action === 'artisan') {
    const artisanId = arg1.trim()
    if (!artisanId) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Некоректний майстер',
        showAlert: true,
      })
      return
    }

    const artisan = await prisma.artisan.findFirst({
      where: {
        id: artisanId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    })

    if (!artisan) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Майстра не знайдено або він неактивний',
        showAlert: true,
      })
      return
    }

    await answerCallbackQuery({ callbackQueryId: callback.id, text: 'Майстра обрано' })

    await sendItemTypePicker({
      chatId,
      userId: fromUserId,
      sessionKey,
      draft: {
        ...draft,
        artisanId: artisan.id,
        artisanName: artisan.name,
      },
    })
    return
  }

  if (action === 'itype') {
    if (!draft.artisanId || !draft.artisanName) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Спочатку обери майстра',
        showAlert: true,
      })
      await sendArtisanPicker(chatId)
      return
    }

    const itemType = arg1 === 'catalog' ? 'CATALOG_VARIANT' : 'CUSTOM_ITEM'

    await answerCallbackQuery({ callbackQueryId: callback.id, text: 'Тип обрано' })

    await setSession({
      sessionKey,
      userId: fromUserId,
      draft: {
        ...draft,
        itemType,
        stage: 'AWAIT_ITEM_LABEL',
      },
    })

    await sendTelegramMessage({
      chatId,
      text:
        itemType === 'CATALOG_VARIANT'
          ? 'Введи назву товару з каталогу (або назву+варіант як тобі зручно).'
          : 'Введи назву унікального товару (ця назва не потрапить у каталог).',
    })
    return
  }

  if (action === 'note') {
    await setSession({
      sessionKey,
      userId: fromUserId,
      draft: {
        ...draft,
        stage: 'AWAIT_NOTE',
      },
    })

    await answerCallbackQuery({ callbackQueryId: callback.id, text: 'Додай примітку' })
    await sendTelegramMessage({
      chatId,
      text: 'Введи примітку текстом. Щоб очистити примітку, надішли <code>-</code>.',
    })
    return
  }

  if (action === 'save') {
    await saveAdminProduction({
      callbackQueryId: callback.id,
      chatId,
      userId: fromUserId,
      sessionKey,
      draft,
    })
    return
  }

  if (action === 'settle_artisan') {
    const artisanId = arg1.trim()
    if (!artisanId) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Некоректний майстер',
        showAlert: true,
      })
      return
    }

    const artisan = await prisma.artisan.findUnique({
      where: { id: artisanId },
      select: { id: true, name: true },
    })

    if (!artisan) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Майстра не знайдено',
        showAlert: true,
      })
      return
    }

    await answerCallbackQuery({ callbackQueryId: callback.id, text: 'Обрано майстра' })

    await sendSettleRecordPicker({
      chatId,
      userId: fromUserId,
      sessionKey,
      artisanId: artisan.id,
      artisanName: artisan.name,
    })
    return
  }

  if (action === 'settle_record') {
    const productionId = arg1.trim()
    if (!productionId) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Некоректний запис',
        showAlert: true,
      })
      return
    }

    const production = await prisma.adminProduction.findUnique({
      where: { id: productionId },
      include: {
        artisan: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!production) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Запис не знайдено',
        showAlert: true,
      })
      return
    }

    const remainingDebtUAH = Math.max(
      0,
      production.totalLaborUAH - production.settledAmountUAH,
    )

    if (remainingDebtUAH <= 0) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'У цьому записі вже немає боргу',
        showAlert: true,
      })
      return
    }

    await answerCallbackQuery({ callbackQueryId: callback.id, text: 'Обрано запис' })

    await setSession({
      sessionKey,
      userId: fromUserId,
      draft: {
        ...draft,
        stage: 'AWAIT_SETTLE_AMOUNT',
        artisanId: production.artisan.id,
        artisanName: production.artisan.name,
        settleProductionId: production.id,
        settleProductionLabel: `${formatDate(production.producedAt)} • ${production.itemLabel}`,
        settleRemainingDebtUAH: remainingDebtUAH,
        settleAmountUAH: undefined,
        settleNotes: undefined,
      },
    })

    await sendTelegramMessage({
      chatId,
      text: [
        `<b>Майстер:</b> ${escapeHtml(production.artisan.name)}`,
        `<b>Запис:</b> ${escapeHtml(production.itemLabel)}`,
        `<b>Борг:</b> ${formatUAH(remainingDebtUAH)}`,
        'Крок 3/3: Введи суму відшкодування.',
      ].join('\n'),
    })
    return
  }

  if (action === 'settle_note') {
    await setSession({
      sessionKey,
      userId: fromUserId,
      draft: {
        ...draft,
        stage: 'AWAIT_SETTLE_NOTE',
      },
    })

    await answerCallbackQuery({ callbackQueryId: callback.id, text: 'Зміни примітку' })
    await sendTelegramMessage({
      chatId,
      text: 'Введи примітку для відшкодування або <code>-</code> щоб очистити.',
    })
    return
  }

  if (action === 'save_settle') {
    await saveDebtSettlement({
      callbackQueryId: callback.id,
      chatId,
      userId: fromUserId,
      sessionKey,
      draft,
    })
    return
  }

  await answerCallbackQuery({
    callbackQueryId: callback.id,
    text: 'Невідома дія',
    showAlert: true,
  })
}

async function handleMessage(message: TelegramMessage) {
  const chatId = toTelegramId(message.chat.id)
  const from = message.from
  if (!from) return

  const userId = toTelegramId(from.id)
  let text = message.text?.trim() || ''
  if (!text) return

  const buttonCommand = mapMenuButtonToCommand(text)
  if (buttonCommand) {
    text = `/${buttonCommand}`
  }

  const parsedCommand = parseCommand(text)
  if (parsedCommand) {
    await handleCommand({
      command: parsedCommand.command,
      chatId,
      chatType: message.chat.type,
      userId,
    })
    return
  }

  if (message.chat.type !== 'private') {
    return
  }

  if (!isAllowedAdmin(userId)) {
    return
  }

  await handleDraftTextInput({
    chatId,
    chatType: message.chat.type,
    userId,
    text,
  })
}

export async function handleTelegramProductionUpdate(
  update: TelegramUpdate,
): Promise<void> {
  if (!isTelegramUpdatePayload(update)) return

  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query)
    return
  }

  if (update.message) {
    await handleMessage(update.message)
  }
}
