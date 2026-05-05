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

type MasterDraftFlow =
  | 'CHOOSE_PRODUCT'
  | 'CHOOSE_VARIANT'
  | 'AWAIT_QTY'
  | 'REVIEW'
  | 'EDIT_ITEM_QTY'

type SessionDraftItem = {
  rateId: string
  variantId: string
  qty: number
}

type SessionDraft = {
  masterFlow?: MasterDraftFlow
  selectedProductId?: string
  selectedVariantId?: string
  selectedRateId?: string
  items?: SessionDraftItem[]
  editItemIndex?: number
  rateId?: string
  qty?: number
}

type VariantLike = {
  id: string
  sku?: string | null
  color?: string | null
  modelSize?: string | null
  pouchColor?: string | null
  product: {
    id?: string
    name: string
    slug: string
    sortCatalog?: number
  }
}

type ArtisanRateWithVariant = {
  id: string
  artisanId: string
  variantId: string
  ratePerUnitUAH: number
  variant: {
    id: string
    productId: string
    sku: string | null
    color: string | null
    modelSize: string | null
    pouchColor: string | null
    product: {
      id: string
      name: string
      slug: string
      sortCatalog: number
    }
  }
}

type DraftResolvedItem = {
  item: SessionDraftItem
  rate: ArtisanRateWithVariant | null
}

const TELEGRAM_API_TIMEOUT_MS = 4500
const CALLBACK_PREFIX = 'prod'
const MASTER_MAX_ITEMS = 20
const SUBMISSION_DUPLICATE_WINDOW_MS = 10_000
const recentSubmissionBySession = new Map<
  string,
  { fingerprint: string; at: number }
>()

const MENU_BUTTONS = {
  record: '🧵 Новий запис',
  help: '❓ Допомога',
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

function toTelegramId(value: number | string): string {
  return String(value)
}

function parseInteger(input: string): number | null {
  const normalized = input.replace(/\s+/g, '')
  if (!/^\d+$/.test(normalized)) return null
  const parsed = Number(normalized)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function normalizeText(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function parseStartRegistrationCode(args: string): string | null {
  const token = args.trim().split(/\s+/)[0]?.trim()
  if (!token) return null
  if (token.startsWith('reg_')) return token.slice(4).trim() || null
  if (token.startsWith('register_')) return token.slice(9).trim() || null
  return token
}

function getVariantAttributes(
  variant: Pick<VariantLike, 'color' | 'modelSize' | 'pouchColor'>,
): string[] {
  const attributes: string[] = []
  const color = normalizeText(variant.color)
  const modelSize = normalizeText(variant.modelSize)
  const pouchColor = normalizeText(variant.pouchColor)
  if (color) attributes.push(`колір: ${color}`)
  if (modelSize) attributes.push(`розмір: ${modelSize}`)
  if (pouchColor) attributes.push(`мішечок: ${pouchColor}`)
  return attributes
}

function getVariantShortDescriptor(
  variant: Pick<
    VariantLike,
    'color' | 'modelSize' | 'pouchColor' | 'sku' | 'id'
  >,
): string {
  return (
    normalizeText(variant.color) ??
    normalizeText(variant.modelSize) ??
    normalizeText(variant.pouchColor) ??
    normalizeText(variant.sku) ??
    variant.id.slice(0, 8)
  )
}

function formatVariantLabel(variant: VariantLike): string {
  const attributes = getVariantAttributes(variant)
  const sku = normalizeText(variant.sku)
  const fallback = sku ? `sku: ${sku}` : `id: ${variant.id.slice(0, 8)}`
  const details = attributes.length > 0 ? attributes.join(', ') : fallback
  return `${variant.product.name} • ${details}`
}

function formatVariantButtonLabel(variant: VariantLike): string {
  const shortDetail = getVariantShortDescriptor(variant)
  return `${variant.product.name} • ${shortDetail}`
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
    dopomoha: 'help',
    help: 'help',
    допомога: 'help',

    reyestraciya: 'register',
    reyestratsiya: 'register',
    registraciya: 'register',
    register: 'register',
    реєстрація: 'register',

    zapys: 'record',
    record: 'record',
    запис: 'record',

    kilkist: 'qty',
    qty: 'qty',
    кількість: 'qty',
  }

  return aliases[normalized] ?? normalized
}

function mapMenuButtonToCommand(text: string): string | null {
  if (text === MENU_BUTTONS.record) return 'zapys'
  if (text === MENU_BUTTONS.help) return 'dopomoha'
  return null
}

function buildMainMenuKeyboard(): TelegramReplyKeyboardButton[][] {
  return [[{ text: MENU_BUTTONS.record }], [{ text: MENU_BUTTONS.help }]]
}

function buildMasterHelpText() {
  return [
    '<b>Команди майстра (UA)</b>',
    '/zapys - зафіксувати виробіток (товар → варіант → кількість)',
    '/dopomoha - підказка',
    '',
    'Після кількості: зберегти і продовжити або завершити і відправити.',
    'У підсумку можна змінити кількість перед відправкою.',
  ].join('\n')
}

function getBotToken(): string | null {
  const token = process.env.TELEGRAM_PRODUCTION_BOT_TOKEN?.trim()
  return token || null
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

function parseSessionDraft(
  draftPayload: Prisma.JsonValue | null,
): SessionDraft {
  if (
    !draftPayload ||
    typeof draftPayload !== 'object' ||
    Array.isArray(draftPayload)
  ) {
    return {}
  }

  const raw = draftPayload as Record<string, unknown>
  const next: SessionDraft = {}

  if (
    raw.masterFlow === 'CHOOSE_PRODUCT' ||
    raw.masterFlow === 'CHOOSE_VARIANT' ||
    raw.masterFlow === 'AWAIT_QTY' ||
    raw.masterFlow === 'REVIEW' ||
    raw.masterFlow === 'EDIT_ITEM_QTY'
  ) {
    next.masterFlow = raw.masterFlow
  }

  if (
    typeof raw.selectedProductId === 'string' &&
    raw.selectedProductId.trim().length > 0
  ) {
    next.selectedProductId = raw.selectedProductId.trim()
  }

  if (
    typeof raw.selectedVariantId === 'string' &&
    raw.selectedVariantId.trim().length > 0
  ) {
    next.selectedVariantId = raw.selectedVariantId.trim()
  }

  if (
    typeof raw.selectedRateId === 'string' &&
    raw.selectedRateId.trim().length > 0
  ) {
    next.selectedRateId = raw.selectedRateId.trim()
  }

  if (
    typeof raw.editItemIndex === 'number' &&
    Number.isInteger(raw.editItemIndex) &&
    raw.editItemIndex >= 0
  ) {
    next.editItemIndex = raw.editItemIndex
  }

  if (typeof raw.rateId === 'string' && raw.rateId.trim().length > 0) {
    next.rateId = raw.rateId.trim()
  }

  if (typeof raw.qty === 'number' && Number.isInteger(raw.qty) && raw.qty > 0) {
    next.qty = raw.qty
  }

  if (Array.isArray(raw.items)) {
    const items: SessionDraftItem[] = []
    for (const item of raw.items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const candidate = item as Record<string, unknown>
      if (typeof candidate.rateId !== 'string' || !candidate.rateId.trim())
        continue
      if (
        typeof candidate.variantId !== 'string' ||
        !candidate.variantId.trim()
      )
        continue
      if (
        typeof candidate.qty !== 'number' ||
        !Number.isInteger(candidate.qty) ||
        candidate.qty <= 0
      ) {
        continue
      }
      items.push({
        rateId: candidate.rateId.trim(),
        variantId: candidate.variantId.trim(),
        qty: candidate.qty,
      })
    }

    if (items.length > 0) {
      next.items = items.slice(0, MASTER_MAX_ITEMS)
    }
  }

  return next
}

function buildSessionDraftJson(draft: SessionDraft): Prisma.JsonObject {
  const payload: Prisma.JsonObject = {}
  if (draft.masterFlow) payload.masterFlow = draft.masterFlow
  if (draft.selectedProductId)
    payload.selectedProductId = draft.selectedProductId
  if (draft.selectedVariantId)
    payload.selectedVariantId = draft.selectedVariantId
  if (draft.selectedRateId) payload.selectedRateId = draft.selectedRateId
  if (typeof draft.editItemIndex === 'number')
    payload.editItemIndex = draft.editItemIndex
  if (draft.rateId) payload.rateId = draft.rateId
  if (typeof draft.qty === 'number') payload.qty = draft.qty

  if (draft.items && draft.items.length > 0) {
    payload.items = draft.items.map((item) => ({
      rateId: item.rateId,
      variantId: item.variantId,
      qty: item.qty,
    }))
  }

  return payload
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

async function deleteTelegramMessage(input: {
  chatId: string
  messageId: number
}): Promise<void> {
  await callTelegramApi('deleteMessage', {
    chat_id: input.chatId,
    message_id: input.messageId,
  })
}

async function deleteCallbackMessage(
  callback: TelegramCallbackQuery,
): Promise<void> {
  const chatId = callback.message?.chat?.id
  const messageId = callback.message?.message_id
  if (!chatId || !messageId) return

  await deleteTelegramMessage({
    chatId: toTelegramId(chatId),
    messageId,
  })
}

async function findLinkedArtisanByTelegram(input: {
  userId: string
  chatId: string
  chatType: TelegramChat['type']
  username?: string
}) {
  let artisan = await prisma.artisan.findFirst({
    where: {
      isActive: true,
      telegramUserId: input.userId,
    },
  })

  if (!artisan && input.chatType === 'private') {
    artisan = await prisma.artisan.findFirst({
      where: {
        isActive: true,
        telegramChatId: input.chatId,
      },
    })
  }

  if (!artisan) return null

  const shouldUpdateUserId = artisan.telegramUserId !== input.userId
  const shouldUpdateUsername =
    artisan.telegramUsername !== (input.username ?? null)
  const shouldUpdateChatId =
    input.chatType === 'private' && artisan.telegramChatId !== input.chatId

  if (!shouldUpdateUserId && !shouldUpdateUsername && !shouldUpdateChatId) {
    return artisan
  }

  return prisma.artisan.update({
    where: { id: artisan.id },
    data: {
      telegramUserId: input.userId,
      telegramUsername: input.username ?? null,
      ...(input.chatType === 'private' ? { telegramChatId: input.chatId } : {}),
    },
  })
}

async function getActiveArtisanRates(
  artisanId: string,
): Promise<ArtisanRateWithVariant[]> {
  return prisma.artisanRate.findMany({
    where: {
      artisanId,
      isActive: true,
    },
    select: {
      id: true,
      artisanId: true,
      variantId: true,
      ratePerUnitUAH: true,
      variant: {
        select: {
          id: true,
          productId: true,
          sku: true,
          color: true,
          modelSize: true,
          pouchColor: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              sortCatalog: true,
            },
          },
        },
      },
    },
    orderBy: [
      { variant: { product: { sortCatalog: 'asc' } } },
      { variant: { product: { name: 'asc' } } },
      { variant: { color: 'asc' } },
      { variant: { modelSize: 'asc' } },
      { id: 'asc' },
    ],
    take: 200,
  })
}

async function resolveDraftItems(input: {
  artisanId: string
  items: SessionDraftItem[]
}): Promise<DraftResolvedItem[]> {
  if (input.items.length === 0) return []

  const uniqueRateIds = Array.from(
    new Set(input.items.map((item) => item.rateId)),
  )
  const rates = await prisma.artisanRate.findMany({
    where: {
      artisanId: input.artisanId,
      id: {
        in: uniqueRateIds,
      },
    },
    select: {
      id: true,
      artisanId: true,
      variantId: true,
      ratePerUnitUAH: true,
      variant: {
        select: {
          id: true,
          productId: true,
          sku: true,
          color: true,
          modelSize: true,
          pouchColor: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              sortCatalog: true,
            },
          },
        },
      },
    },
  })

  const byRateId = new Map(rates.map((rate) => [rate.id, rate]))
  return input.items.map((item) => ({
    item,
    rate: byRateId.get(item.rateId) ?? null,
  }))
}

function buildResolvedItemsSummary(resolved: DraftResolvedItem[]): {
  lines: string[]
  totalQty: number
  totalAmount: number
} {
  const lines: string[] = []
  let totalQty = 0
  let totalAmount = 0

  resolved.forEach((entry, index) => {
    if (!entry.rate) {
      lines.push(
        `${index + 1}. ⚠️ Недоступна позиція (rateId: <code>${escapeHtml(entry.item.rateId)}</code>)`,
      )
      return
    }

    const lineTotal = entry.item.qty * entry.rate.ratePerUnitUAH
    totalQty += entry.item.qty
    totalAmount += lineTotal

    lines.push(
      `${index + 1}. ${escapeHtml(entry.rate.variant.product.name)} • ${escapeHtml(getVariantShortDescriptor(entry.rate.variant))} — ${entry.item.qty} × ${formatUAH(entry.rate.ratePerUnitUAH)} = <b>${formatUAH(lineTotal)}</b>`,
    )
  })

  return { lines, totalQty, totalAmount }
}

function buildDraftFingerprint(input: {
  artisanId: string
  items: SessionDraftItem[]
}): string {
  const rows = input.items
    .slice()
    .sort((left, right) => {
      if (left.rateId === right.rateId) return left.qty - right.qty
      return left.rateId.localeCompare(right.rateId)
    })
    .map((item) => `${item.rateId}:${item.qty}`)
  return `${input.artisanId}|${rows.join('|')}`
}

function isRecentDuplicateSubmission(input: {
  sessionKey: string
  fingerprint: string
}): boolean {
  const now = Date.now()
  const recent = recentSubmissionBySession.get(input.sessionKey)
  if (!recent) return false
  if (now - recent.at > SUBMISSION_DUPLICATE_WINDOW_MS) {
    recentSubmissionBySession.delete(input.sessionKey)
    return false
  }
  return recent.fingerprint === input.fingerprint
}

function markRecentSubmission(input: {
  sessionKey: string
  fingerprint: string
}) {
  const now = Date.now()
  for (const [key, value] of recentSubmissionBySession) {
    if (now - value.at > SUBMISSION_DUPLICATE_WINDOW_MS) {
      recentSubmissionBySession.delete(key)
    }
  }
  recentSubmissionBySession.set(input.sessionKey, {
    fingerprint: input.fingerprint,
    at: now,
  })
}

async function setSession(input: {
  sessionKey: string
  userId?: string
  artisanId?: string
  step: TelegramBotSessionStep
  draft?: SessionDraft
}) {
  await prisma.telegramBotSession.upsert({
    where: { chatId: input.sessionKey },
    create: {
      chatId: input.sessionKey,
      userId: input.userId ?? null,
      artisanId: input.artisanId ?? null,
      step: input.step,
      draftPayload: buildSessionDraftJson(input.draft ?? {}),
    },
    update: {
      userId: input.userId ?? null,
      artisanId: input.artisanId ?? null,
      step: input.step,
      draftPayload: buildSessionDraftJson(input.draft ?? {}),
    },
  })
}

async function clearSession(sessionKey: string) {
  await setSession({
    sessionKey,
    step: TelegramBotSessionStep.IDLE,
    draft: {},
  })
}

async function getSession(sessionKey: string) {
  return prisma.telegramBotSession.findUnique({ where: { chatId: sessionKey } })
}

async function sendMasterProductPicker(input: {
  chatId: string
  userId: string
  artisanId: string
  sessionKey: string
  draft?: SessionDraft
  notice?: string
}) {
  const rates = await getActiveArtisanRates(input.artisanId)
  if (rates.length === 0) {
    await clearSession(input.sessionKey)
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Для тебе ще не налаштовано ставок по виробах. Звернись до власника.',
    })
    return
  }

  const products = Array.from(
    new Map(
      rates.map((rate) => [rate.variant.product.id, rate.variant.product]),
    ).values(),
  )

  const draftItems = (input.draft?.items ?? []).slice(0, MASTER_MAX_ITEMS)

  await setSession({
    sessionKey: input.sessionKey,
    userId: input.userId,
    artisanId: input.artisanId,
    step: TelegramBotSessionStep.AWAITING_CONFIRM,
    draft: {
      ...(input.draft ?? {}),
      masterFlow: 'CHOOSE_PRODUCT',
      selectedProductId: undefined,
      selectedVariantId: undefined,
      selectedRateId: undefined,
      editItemIndex: undefined,
      rateId: undefined,
      qty: undefined,
      items: draftItems.length > 0 ? draftItems : undefined,
    },
  })

  const rows: TelegramInlineKeyboardButton[][] = products.map((product) => [
    {
      text: product.name,
      callback_data: `${CALLBACK_PREFIX}:mp:${product.id}`,
    },
  ])

  if (draftItems.length > 0) {
    rows.push([
      {
        text: '✅ Завершити і відправити',
        callback_data: `${CALLBACK_PREFIX}:mfinish`,
      },
    ])
  }

  rows.push([
    { text: '↩️ Скасувати', callback_data: `${CALLBACK_PREFIX}:cancel` },
  ])

  const textLines = ['<b>Крок 1/3</b> Обери товар:']
  if (input.notice) textLines.unshift(input.notice)

  if (draftItems.length > 0) {
    const ratesById = new Map(rates.map((rate) => [rate.id, rate]))
    const preview = buildResolvedItemsSummary(
      draftItems.map((item) => ({
        item,
        rate: ratesById.get(item.rateId) ?? null,
      })),
    )

    textLines.push('')
    textLines.push('<b>Чернетка:</b>')
    textLines.push(...preview.lines.slice(0, 5))
    if (preview.lines.length > 5) {
      textLines.push(`… та ще ${preview.lines.length - 5} позицій`)
    }
    textLines.push(
      `<b>Разом:</b> ${preview.totalQty} шт • ${formatUAH(preview.totalAmount)}`,
    )
  }

  await sendTelegramMessage({
    chatId: input.chatId,
    text: textLines.join('\n'),
    inlineKeyboard: rows,
  })
}

async function sendMasterVariantPicker(input: {
  chatId: string
  userId: string
  artisanId: string
  sessionKey: string
  productId: string
  draft?: SessionDraft
}) {
  const rates = await getActiveArtisanRates(input.artisanId)
  const productRates = rates.filter(
    (rate) => rate.variant.productId === input.productId,
  )

  if (productRates.length === 0) {
    await sendMasterProductPicker({
      chatId: input.chatId,
      userId: input.userId,
      artisanId: input.artisanId,
      sessionKey: input.sessionKey,
      draft: input.draft,
      notice:
        'Для цього товару зараз немає активних ставок. Обери інший товар.',
    })
    return
  }

  const product = productRates[0]!.variant.product

  await setSession({
    sessionKey: input.sessionKey,
    userId: input.userId,
    artisanId: input.artisanId,
    step: TelegramBotSessionStep.AWAITING_CONFIRM,
    draft: {
      ...(input.draft ?? {}),
      masterFlow: 'CHOOSE_VARIANT',
      selectedProductId: input.productId,
      selectedVariantId: undefined,
      selectedRateId: undefined,
      editItemIndex: undefined,
      rateId: undefined,
      qty: undefined,
    },
  })

  const rows: TelegramInlineKeyboardButton[][] = productRates.map((rate) => [
    {
      text: `${formatVariantButtonLabel(rate.variant)} • ${formatUAH(rate.ratePerUnitUAH)}`,
      callback_data: `${CALLBACK_PREFIX}:mv:${rate.id}`,
    },
  ])

  rows.push([{ text: '⬅️ Назад', callback_data: `${CALLBACK_PREFIX}:mbp` }])
  rows.push([
    { text: '↩️ Скасувати', callback_data: `${CALLBACK_PREFIX}:cancel` },
  ])

  await sendTelegramMessage({
    chatId: input.chatId,
    text: `<b>Крок 2/3</b> ${escapeHtml(product.name)}\nОбери варіант:`,
    inlineKeyboard: rows,
  })
}

async function sendMasterQtyPrompt(input: {
  chatId: string
  userId: string
  artisanId: string
  sessionKey: string
  rate: ArtisanRateWithVariant
  draft?: SessionDraft
}) {
  await setSession({
    sessionKey: input.sessionKey,
    userId: input.userId,
    artisanId: input.artisanId,
    step: TelegramBotSessionStep.AWAITING_QTY,
    draft: {
      ...(input.draft ?? {}),
      masterFlow: 'AWAIT_QTY',
      selectedProductId: input.rate.variant.productId,
      selectedVariantId: input.rate.variantId,
      selectedRateId: input.rate.id,
      editItemIndex: undefined,
      rateId: undefined,
      qty: undefined,
    },
  })

  await sendTelegramMessage({
    chatId: input.chatId,
    text: [
      `<b>Крок 3/3</b> ${escapeHtml(formatVariantLabel(input.rate.variant))}`,
      `Ставка: <b>${formatUAH(input.rate.ratePerUnitUAH)}</b>`,
      'Надішли кількість одним числом (наприклад: <code>7</code>).',
    ].join('\n'),
    inlineKeyboard: [
      [
        {
          text: '⬅️ Назад',
          callback_data: `${CALLBACK_PREFIX}:mbv:${input.rate.variant.productId}`,
        },
      ],
      [{ text: '↩️ Скасувати', callback_data: `${CALLBACK_PREFIX}:cancel` }],
    ],
  })
}

async function sendMasterDraftSummary(input: {
  chatId: string
  userId: string
  artisanId: string
  sessionKey: string
  draft: SessionDraft
  notice?: string
}) {
  const items = (input.draft.items ?? []).slice(0, MASTER_MAX_ITEMS)
  if (items.length === 0) {
    await sendMasterProductPicker({
      chatId: input.chatId,
      userId: input.userId,
      artisanId: input.artisanId,
      sessionKey: input.sessionKey,
      draft: input.draft,
      notice: input.notice ?? 'Чернетка порожня, додай хоча б одну позицію.',
    })
    return
  }

  const resolved = await resolveDraftItems({
    artisanId: input.artisanId,
    items,
  })
  const summary = buildResolvedItemsSummary(resolved)

  await setSession({
    sessionKey: input.sessionKey,
    userId: input.userId,
    artisanId: input.artisanId,
    step: TelegramBotSessionStep.AWAITING_CONFIRM,
    draft: {
      ...(input.draft ?? {}),
      items,
      masterFlow: 'REVIEW',
      selectedProductId: undefined,
      selectedVariantId: undefined,
      selectedRateId: undefined,
      editItemIndex: undefined,
      rateId: undefined,
      qty: undefined,
    },
  })

  const rows: TelegramInlineKeyboardButton[][] = []
  resolved.forEach((_, index) => {
    rows.push([
      {
        text: `✏️ Змінити кількість #${index + 1}`,
        callback_data: `${CALLBACK_PREFIX}:medit:${index}`,
      },
    ])
  })
  rows.push([
    {
      text: '➕ Зберегти і продовжити',
      callback_data: `${CALLBACK_PREFIX}:mbp`,
    },
    {
      text: '✅ Завершити і відправити',
      callback_data: `${CALLBACK_PREFIX}:mfinish`,
    },
  ])
  rows.push([
    { text: '↩️ Скасувати', callback_data: `${CALLBACK_PREFIX}:cancel` },
  ])

  const textLines = ['<b>Підсумок перед відправленням</b>']
  if (input.notice) textLines.push(input.notice)
  textLines.push(...summary.lines)
  textLines.push('')
  textLines.push(
    `<b>Разом:</b> ${summary.totalQty} шт • ${formatUAH(summary.totalAmount)}`,
  )

  await sendTelegramMessage({
    chatId: input.chatId,
    text: textLines.join('\n'),
    inlineKeyboard: rows,
  })
}

async function handleRegisterCommand(input: {
  chatId: string
  chatType: TelegramChat['type']
  userId: string
  username?: string
  args: string
}) {
  const code = input.args.trim()
  if (!code) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Вкажи код у форматі: <code>/reyestraciya CODE</code>',
    })
    return
  }

  const artisan = await prisma.artisan.findFirst({
    where: {
      accessCode: {
        equals: code,
        mode: 'insensitive',
      },
    },
  })

  if (!artisan || !artisan.isActive) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Код не знайдено або майстер неактивний.',
    })
    return
  }

  if (artisan.telegramUserId && artisan.telegramUserId !== input.userId) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: "Цей код вже прив'язаний до іншого Telegram акаунта. Звернись до власника.",
    })
    return
  }

  const updated = await prisma.artisan.update({
    where: { id: artisan.id },
    data: {
      telegramUserId: input.userId,
      telegramUsername: input.username ?? null,
      ...(input.chatType === 'private' ? { telegramChatId: input.chatId } : {}),
    },
  })

  const sessionKey = buildSessionKey({
    chatId: input.chatId,
    userId: input.userId,
    chatType: input.chatType,
  })

  await clearSession(sessionKey)

  await sendTelegramMessage({
    chatId: input.chatId,
    text: [
      `✅ Майстра <b>${escapeHtml(updated.name)}</b> успішно прив\'язано.`,
      'Використовуй кнопку <b>🧵 Новий запис</b>: товар → варіант → кількість.',
    ].join('\n'),
    replyKeyboard: buildMainMenuKeyboard(),
  })
}

async function handleRecordCommand(input: {
  chatId: string
  chatType: TelegramChat['type']
  userId: string
  username?: string
}) {
  const artisan = await findLinkedArtisanByTelegram({
    userId: input.userId,
    chatId: input.chatId,
    chatType: input.chatType,
    username: input.username,
  })

  if (!artisan) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: [
        "Цей Telegram не прив'язаний до майстра.",
        'Надішли <code>/reyestraciya CODE</code>, де CODE дає власник.',
      ].join('\n'),
    })
    return
  }

  const sessionKey = buildSessionKey({
    chatId: input.chatId,
    userId: input.userId,
    chatType: input.chatType,
  })

  await sendMasterProductPicker({
    chatId: input.chatId,
    userId: input.userId,
    artisanId: artisan.id,
    sessionKey,
    draft: {
      items: [],
    },
  })
}

async function processQtyInput(input: {
  chatId: string
  chatType: TelegramChat['type']
  userId: string
  username?: string
  qtyRaw: string
}) {
  const artisan = await findLinkedArtisanByTelegram({
    userId: input.userId,
    chatId: input.chatId,
    chatType: input.chatType,
    username: input.username,
  })

  if (!artisan) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Спочатку виконай <code>/reyestraciya CODE</code>.',
    })
    return
  }

  const sessionKey = buildSessionKey({
    chatId: input.chatId,
    userId: input.userId,
    chatType: input.chatType,
  })

  const session = await getSession(sessionKey)
  if (!session || session.step !== TelegramBotSessionStep.AWAITING_QTY) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Немає активного кроку кількості. Використай кнопку <b>🧵 Новий запис</b>.',
    })
    return
  }

  const draft = parseSessionDraft(session.draftPayload)
  const qty = parseInteger(input.qtyRaw)

  if (!qty || qty > 5000) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Введи коректну кількість числом (від 1 до 5000).',
    })
    return
  }

  if (draft.masterFlow === 'EDIT_ITEM_QTY') {
    const items = [...(draft.items ?? [])]
    const index = draft.editItemIndex

    if (typeof index !== 'number' || index < 0 || index >= items.length) {
      await sendMasterDraftSummary({
        chatId: input.chatId,
        userId: input.userId,
        artisanId: artisan.id,
        sessionKey,
        draft,
        notice: 'Не вдалося знайти позицію для редагування. Оновлюю підсумок.',
      })
      return
    }

    items[index] = {
      ...items[index]!,
      qty,
    }

    await sendMasterDraftSummary({
      chatId: input.chatId,
      userId: input.userId,
      artisanId: artisan.id,
      sessionKey,
      draft: {
        ...draft,
        items,
        editItemIndex: undefined,
      },
      notice: `Кількість для позиції #${index + 1} оновлено.`,
    })
    return
  }

  const selectedRateId = draft.selectedRateId ?? draft.rateId
  if (!selectedRateId) {
    await clearSession(sessionKey)
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Сесія застаріла. Повтори через кнопку <b>🧵 Новий запис</b>.',
    })
    return
  }

  const rate = await prisma.artisanRate.findFirst({
    where: {
      id: selectedRateId,
      artisanId: artisan.id,
      isActive: true,
    },
    select: {
      id: true,
      artisanId: true,
      variantId: true,
      ratePerUnitUAH: true,
      variant: {
        select: {
          id: true,
          productId: true,
          sku: true,
          color: true,
          modelSize: true,
          pouchColor: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              sortCatalog: true,
            },
          },
        },
      },
    },
  })

  if (!rate) {
    await clearSession(sessionKey)
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Ставка більше неактивна. Повтори через кнопку <b>🧵 Новий запис</b>.',
    })
    return
  }

  const total = qty * rate.ratePerUnitUAH

  await setSession({
    sessionKey,
    userId: input.userId,
    artisanId: artisan.id,
    step: TelegramBotSessionStep.AWAITING_CONFIRM,
    draft: {
      ...draft,
      masterFlow: 'REVIEW',
      selectedProductId: rate.variant.productId,
      selectedVariantId: rate.variantId,
      selectedRateId: rate.id,
      rateId: rate.id,
      qty,
    },
  })

  const canAddMore = (draft.items?.length ?? 0) < MASTER_MAX_ITEMS

  await sendTelegramMessage({
    chatId: input.chatId,
    text: [
      'Позицію підготовлено:',
      `<b>Варіант:</b> ${escapeHtml(formatVariantLabel(rate.variant))}`,
      `<b>К-сть:</b> ${qty}`,
      `<b>Ставка:</b> ${formatUAH(rate.ratePerUnitUAH)}`,
      `<b>Сума:</b> ${formatUAH(total)}`,
      canAddMore
        ? 'Обери: <b>зберегти і продовжити</b> або <b>завершити і відправити</b>.'
        : 'Досягнуто ліміту позицій, заверши і відправ.',
    ].join('\n'),
    inlineKeyboard: [
      ...(canAddMore
        ? [
            [
              {
                text: '💾 Зберегти і продовжити',
                callback_data: `${CALLBACK_PREFIX}:madd`,
              },
            ],
          ]
        : []),
      [
        {
          text: '✅ Завершити і відправити',
          callback_data: `${CALLBACK_PREFIX}:mfinish`,
        },
      ],
      [
        {
          text: '⬅️ Назад',
          callback_data: `${CALLBACK_PREFIX}:mbv:${rate.variant.productId}`,
        },
      ],
      [{ text: '↩️ Скасувати', callback_data: `${CALLBACK_PREFIX}:cancel` }],
    ],
  })
}

async function finalizeMasterDraft(input: {
  callback: TelegramCallbackQuery
  callbackQueryId: string
  sessionKey: string
  chatId: string
  artisanId: string
  userId: string
  draft: SessionDraft
}) {
  const artisan = await prisma.artisan.findUnique({
    where: { id: input.artisanId },
    select: { id: true, name: true },
  })

  if (!artisan) {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Майстра не знайдено',
      showAlert: true,
    })
    await clearSession(input.sessionKey)
    return
  }

  const items = [...(input.draft.items ?? [])]
  if (input.draft.rateId && input.draft.qty && input.draft.selectedVariantId) {
    items.push({
      rateId: input.draft.rateId,
      variantId: input.draft.selectedVariantId,
      qty: input.draft.qty,
    })
  }

  if (items.length === 0) {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Чернетка порожня',
      showAlert: true,
    })
    await sendMasterProductPicker({
      chatId: input.chatId,
      userId: input.userId,
      artisanId: input.artisanId,
      sessionKey: input.sessionKey,
      draft: input.draft,
      notice: 'Додай хоча б одну позицію перед відправленням.',
    })
    return
  }

  const aggregatedByRate = new Map<string, SessionDraftItem>()
  for (const item of items) {
    const current = aggregatedByRate.get(item.rateId)
    if (current) {
      current.qty += item.qty
      continue
    }
    aggregatedByRate.set(item.rateId, { ...item })
  }
  const aggregatedItems = Array.from(aggregatedByRate.values())

  const fingerprint = buildDraftFingerprint({
    artisanId: input.artisanId,
    items: aggregatedItems,
  })

  if (
    isRecentDuplicateSubmission({ sessionKey: input.sessionKey, fingerprint })
  ) {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Ця відправка вже оброблена. Зачекай кілька секунд.',
      showAlert: true,
    })
    return
  }

  const rateIds = aggregatedItems.map((item) => item.rateId)
  const rates = await prisma.artisanRate.findMany({
    where: {
      artisanId: input.artisanId,
      isActive: true,
      id: {
        in: rateIds,
      },
    },
    select: {
      id: true,
      artisanId: true,
      variantId: true,
      ratePerUnitUAH: true,
      variant: {
        select: {
          id: true,
          productId: true,
          sku: true,
          color: true,
          modelSize: true,
          pouchColor: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              sortCatalog: true,
            },
          },
        },
      },
    },
  })

  const ratesById = new Map(rates.map((rate) => [rate.id, rate]))
  const missingRates = aggregatedItems.filter(
    (item) => !ratesById.has(item.rateId),
  )

  if (missingRates.length > 0) {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Деякі ставки вже неактивні. Онови чернетку.',
      showAlert: true,
    })

    await sendMasterDraftSummary({
      chatId: input.chatId,
      userId: input.userId,
      artisanId: input.artisanId,
      sessionKey: input.sessionKey,
      draft: {
        ...input.draft,
        items: aggregatedItems.filter((item) => ratesById.has(item.rateId)),
        rateId: undefined,
        qty: undefined,
      },
      notice: 'Частина ставок стала неактивною. Перевір позиції ще раз.',
    })
    return
  }

  markRecentSubmission({ sessionKey: input.sessionKey, fingerprint })

  const result = await prisma.$transaction(async (tx) => {
    const created: Array<{
      id: string
      qty: number
      ratePerUnitUAH: number
      totalLaborUAH: number
      variantId: string
      variant: VariantLike
    }> = []

    for (const item of aggregatedItems) {
      const rate = ratesById.get(item.rateId)!
      const production = await tx.artisanProduction.create({
        data: {
          artisanId: input.artisanId,
          productId: rate.variant.productId,
          variantId: rate.variantId,
          rateId: rate.id,
          qty: item.qty,
          ratePerUnitSnapshotUAH: rate.ratePerUnitUAH,
          totalLaborUAH: item.qty * rate.ratePerUnitUAH,
          status: 'PAID',
          source: 'TELEGRAM_BOT',
          telegramUpdateId: input.callback.message?.message_id,
          approvedAt: new Date(),
          approvedByTelegramUserId: input.userId,
          paidAt: new Date(),
        },
        include: {
          variant: {
            select: {
              id: true,
              sku: true,
              color: true,
              modelSize: true,
              pouchColor: true,
              product: {
                select: {
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      })

      created.push({
        id: production.id,
        qty: production.qty,
        ratePerUnitUAH: production.ratePerUnitSnapshotUAH,
        totalLaborUAH: production.totalLaborUAH,
        variantId: production.variantId,
        variant: production.variant,
      })
    }

    const totalAmount = created.reduce((sum, row) => sum + row.totalLaborUAH, 0)
    const summaryBits = created.map(
      (row) =>
        `${artisan.name}: ${row.variant.product.name} (${getVariantShortDescriptor(row.variant)}), ${row.qty} шт, ${row.ratePerUnitUAH}₴/шт`,
    )

    const expense = await tx.expense.create({
      data: {
        title: summaryBits.join('; '),
        category: ExpenseCategory.PAYROLL,
        amountUAH: totalAmount,
        expenseDate: new Date(),
        notes: [
          'Створено Telegram production bot (майстерський flow)',
          ...created.map(
            (row, index) =>
              `${index + 1}. productionId=${row.id}; variantId=${row.variantId}; qty=${row.qty}; rate=${row.ratePerUnitUAH}; total=${row.totalLaborUAH}`,
          ),
        ].join('\n'),
      },
    })

    await tx.artisanProduction.updateMany({
      where: {
        id: {
          in: created.map((row) => row.id),
        },
      },
      data: {
        paidExpenseId: expense.id,
      },
    })

    return { created, expense }
  })

  await clearSession(input.sessionKey)

  await answerCallbackQuery({
    callbackQueryId: input.callbackQueryId,
    text: 'Відправлено',
  })

  const totalQty = result.created.reduce((sum, row) => sum + row.qty, 0)
  const totalAmount = result.created.reduce(
    (sum, row) => sum + row.totalLaborUAH,
    0,
  )

  await sendTelegramMessage({
    chatId: input.chatId,
    text: [
      '✅ Записи збережено.',
      ...result.created.map(
        (row, index) =>
          `${index + 1}. ${escapeHtml(formatVariantLabel(row.variant))} — ${row.qty} шт, ${formatUAH(row.totalLaborUAH)} (<code>${escapeHtml(row.id)}</code>)`,
      ),
      '',
      `<b>Разом:</b> ${totalQty} шт • ${formatUAH(totalAmount)}`,
      `<b>Expense ID:</b> <code>${escapeHtml(result.expense.id)}</code>`,
    ].join('\n'),
  })
}

async function handleMasterFreeText(input: {
  chatId: string
  chatType: TelegramChat['type']
  userId: string
  username?: string
  text: string
}) {
  const sessionKey = buildSessionKey({
    chatId: input.chatId,
    userId: input.userId,
    chatType: input.chatType,
  })

  const session = await getSession(sessionKey)
  if (!session || session.step === TelegramBotSessionStep.IDLE) return

  const draft = parseSessionDraft(session.draftPayload)

  if (session.step === TelegramBotSessionStep.AWAITING_QTY) {
    await processQtyInput({
      chatId: input.chatId,
      chatType: input.chatType,
      userId: input.userId,
      username: input.username,
      qtyRaw: input.text,
    })
    return
  }

  if (session.step === TelegramBotSessionStep.AWAITING_CONFIRM) {
    const message =
      draft.masterFlow === 'REVIEW'
        ? 'Користуйся кнопками нижче: зміни кількість, додай ще позицію або заверши відправку.'
        : 'Натисни потрібну кнопку нижче.'

    await sendTelegramMessage({
      chatId: input.chatId,
      text: message,
    })
  }
}

async function handleCommand(input: {
  command: string
  args: string
  chatId: string
  chatType: TelegramChat['type']
  userId: string
  username?: string
}) {
  const command = normalizeCommand(input.command)

  if (
    input.chatType !== 'private' &&
    ['start', 'register', 'record', 'qty'].includes(command)
  ) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Для майстра цей бот працює лише в приватному чаті. Відкрий бота за персональним лінком і продовж.',
    })
    return
  }

  if (command === 'start') {
    const codeFromStart = parseStartRegistrationCode(input.args)
    if (codeFromStart) {
      await handleRegisterCommand({
        chatId: input.chatId,
        chatType: input.chatType,
        userId: input.userId,
        username: input.username,
        args: codeFromStart,
      })
      return
    }

    await sendTelegramMessage({
      chatId: input.chatId,
      text: buildMasterHelpText(),
      replyKeyboard: buildMainMenuKeyboard(),
    })
    return
  }

  if (command === 'help') {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: buildMasterHelpText(),
      replyKeyboard: buildMainMenuKeyboard(),
    })
    return
  }

  if (command === 'register') {
    await handleRegisterCommand({
      chatId: input.chatId,
      chatType: input.chatType,
      userId: input.userId,
      username: input.username,
      args: input.args,
    })
    return
  }

  if (command === 'record') {
    await handleRecordCommand({
      chatId: input.chatId,
      chatType: input.chatType,
      userId: input.userId,
      username: input.username,
    })
    return
  }

  if (command === 'qty') {
    if (!input.args.trim()) {
      await sendTelegramMessage({
        chatId: input.chatId,
        text: 'Надішли кількість числом (наприклад: <code>10</code>).',
      })
      return
    }

    await processQtyInput({
      chatId: input.chatId,
      chatType: input.chatType,
      userId: input.userId,
      username: input.username,
      qtyRaw: input.args,
    })
    return
  }

  await sendTelegramMessage({
    chatId: input.chatId,
    text: 'Невідома команда. Використай <code>/dopomoha</code> або кнопки нижче.',
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

  const parts = callbackData.split(':')
  const action = parts[1] ?? ''
  const arg1 = parts[2] ?? ''
  const message = callback.message
  const chatId = message?.chat?.id ? toTelegramId(message.chat.id) : null
  const chatType = message?.chat?.type
  const sessionKey =
    chatId && chatType
      ? buildSessionKey({ chatId, userId: fromUserId, chatType })
      : null

  if (!message?.chat?.id || !chatId || !chatType || !sessionKey) {
    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Сесія не знайдена',
      showAlert: true,
    })
    return
  }

  if (action === 'cancel') {
    await clearSession(sessionKey)
    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Скасовано',
    })
    await sendTelegramMessage({
      chatId,
      text: 'Дію скасовано. Для нового запису використовуй кнопку <b>🧵 Новий запис</b>.',
    })
    await deleteCallbackMessage(callback)
    return
  }

  const artisan = await findLinkedArtisanByTelegram({
    userId: fromUserId,
    chatId,
    chatType,
    username: callback.from.username,
  })

  if (!artisan) {
    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Спочатку виконай /reyestraciya CODE',
      showAlert: true,
    })
    return
  }

  const session = await getSession(sessionKey)
  const draft = parseSessionDraft(session?.draftPayload ?? null)

  if (action === 'mp') {
    if (!arg1) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Некоректний товар',
        showAlert: true,
      })
      return
    }

    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Товар обрано',
    })
    await sendMasterVariantPicker({
      chatId,
      userId: fromUserId,
      artisanId: artisan.id,
      sessionKey,
      productId: arg1,
      draft,
    })
    return
  }

  if (action === 'mv' || action === 'rate') {
    if (!arg1) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Некоректний варіант',
        showAlert: true,
      })
      return
    }

    const rate = await prisma.artisanRate.findFirst({
      where: {
        id: arg1,
        artisanId: artisan.id,
        isActive: true,
      },
      select: {
        id: true,
        artisanId: true,
        variantId: true,
        ratePerUnitUAH: true,
        variant: {
          select: {
            id: true,
            productId: true,
            sku: true,
            color: true,
            modelSize: true,
            pouchColor: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                sortCatalog: true,
              },
            },
          },
        },
      },
    })

    if (!rate) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Ставка недоступна',
        showAlert: true,
      })
      return
    }

    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Варіант обрано',
    })
    await sendMasterQtyPrompt({
      chatId,
      userId: fromUserId,
      artisanId: artisan.id,
      sessionKey,
      rate,
      draft,
    })
    return
  }

  if (action === 'mbp') {
    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'До товарів',
    })
    await sendMasterProductPicker({
      chatId,
      userId: fromUserId,
      artisanId: artisan.id,
      sessionKey,
      draft: {
        ...draft,
        rateId: undefined,
        qty: undefined,
        selectedRateId: undefined,
        selectedVariantId: undefined,
      },
    })
    return
  }

  if (action === 'mbv') {
    const productId = arg1 || draft.selectedProductId
    if (!productId) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Не вдалося повернутись до варіантів',
        showAlert: true,
      })
      await sendMasterProductPicker({
        chatId,
        userId: fromUserId,
        artisanId: artisan.id,
        sessionKey,
        draft,
      })
      return
    }

    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'До варіантів',
    })
    await sendMasterVariantPicker({
      chatId,
      userId: fromUserId,
      artisanId: artisan.id,
      sessionKey,
      productId,
      draft: {
        ...draft,
        rateId: undefined,
        qty: undefined,
      },
    })
    return
  }

  if (action === 'madd') {
    if (!draft.rateId || !draft.qty || !draft.selectedVariantId) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Позиція не підготовлена',
        showAlert: true,
      })
      return
    }

    const items = [...(draft.items ?? [])]
    if (items.length >= MASTER_MAX_ITEMS) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Досягнуто ліміт позицій. Заверши відправку.',
        showAlert: true,
      })
      return
    }

    items.push({
      rateId: draft.rateId,
      variantId: draft.selectedVariantId,
      qty: draft.qty,
    })

    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Позицію додано',
    })
    await sendMasterProductPicker({
      chatId,
      userId: fromUserId,
      artisanId: artisan.id,
      sessionKey,
      draft: {
        ...draft,
        items,
        rateId: undefined,
        qty: undefined,
        selectedRateId: undefined,
        selectedVariantId: undefined,
      },
      notice: 'Позицію додано. Обери наступний товар.',
    })
    await deleteCallbackMessage(callback)
    return
  }

  if (action === 'medit') {
    const index = Number.parseInt(arg1 || '', 10)
    const items = draft.items ?? []

    if (!Number.isInteger(index) || index < 0 || index >= items.length) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Позицію не знайдено',
        showAlert: true,
      })
      return
    }

    const item = items[index]!
    await setSession({
      sessionKey,
      userId: fromUserId,
      artisanId: artisan.id,
      step: TelegramBotSessionStep.AWAITING_QTY,
      draft: {
        ...draft,
        masterFlow: 'EDIT_ITEM_QTY',
        editItemIndex: index,
        selectedRateId: item.rateId,
        selectedVariantId: item.variantId,
        rateId: undefined,
        qty: undefined,
      },
    })

    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Редагування кількості',
    })
    await sendTelegramMessage({
      chatId,
      text: `Введи нову кількість для позиції #${index + 1}:`,
      inlineKeyboard: [
        [{ text: '⬅️ Назад', callback_data: `${CALLBACK_PREFIX}:mreview` }],
        [{ text: '↩️ Скасувати', callback_data: `${CALLBACK_PREFIX}:cancel` }],
      ],
    })
    return
  }

  if (action === 'mreview') {
    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Показую підсумок',
    })
    await sendMasterDraftSummary({
      chatId,
      userId: fromUserId,
      artisanId: artisan.id,
      sessionKey,
      draft,
    })
    return
  }

  if (action === 'mfinish') {
    await finalizeMasterDraft({
      callback,
      callbackQueryId: callback.id,
      sessionKey,
      chatId,
      artisanId: artisan.id,
      userId: fromUserId,
      draft,
    })
    await deleteCallbackMessage(callback)
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
      args: parsedCommand.args,
      chatId,
      chatType: message.chat.type,
      userId,
      username: from.username,
    })
    return
  }

  await handleMasterFreeText({
    chatId,
    chatType: message.chat.type,
    userId,
    username: from.username,
    text,
  })
}

export async function handleTelegramProductionUpdate(
  update: TelegramUpdate,
): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query)
    return
  }

  if (update.message) {
    await handleMessage(update.message)
  }
}
