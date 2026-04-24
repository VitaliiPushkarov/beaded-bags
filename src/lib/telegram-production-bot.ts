import {
  ArtisanProductionStatus,
  ExpenseCategory,
  Prisma,
  TelegramBotSessionStep,
} from '@prisma/client'

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

type SessionDraft = {
  rateId?: string
  qty?: number
  ownerFlow?: 'SET_RATE_AWAIT_RATE'
  ownerArtisanId?: string
  ownerVariantId?: string
}

const TELEGRAM_API_TIMEOUT_MS = 4500
const CALLBACK_PREFIX = 'prod'
const OWNER_VARIANTS_PAGE_SIZE = 8
const MENU_BUTTONS = {
  record: '🧵 Новий запис',
  my: '📊 Мій звіт',
  help: '❓ Допомога',
  masters: '👥 Майстри',
  pending: '⏳ Очікують',
  report: '📈 Звіт',
  products: '📦 Товари',
  variants: '🧩 Варіанти',
  ratesMenu: '💵 Ставки',
} as const

function parseCsvIds(raw: string | undefined): string[] {
  if (!raw) return []
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function formatUAH(amount: number): string {
  return `${Math.round(amount).toLocaleString('uk-UA')} ₴`
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Kyiv',
  }).format(date)
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

function parseIdList(input: string): string[] {
  if (!input.trim()) return []

  return Array.from(
    new Set(
      input
        .split(',')
        .flatMap((part) => part.split(/\s+/))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
}

function normalizeText(value?: string | null): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

type VariantLike = {
  id: string
  sku?: string | null
  color?: string | null
  modelSize?: string | null
  pouchColor?: string | null
  product: {
    name: string
    slug: string
  }
}

function getVariantAttributes(variant: Pick<VariantLike, 'color' | 'modelSize' | 'pouchColor'>): string[] {
  const attributes: string[] = []
  const color = normalizeText(variant.color)
  const modelSize = normalizeText(variant.modelSize)
  const pouchColor = normalizeText(variant.pouchColor)
  if (color) attributes.push(`колір: ${color}`)
  if (modelSize) attributes.push(`розмір: ${modelSize}`)
  if (pouchColor) attributes.push(`мішечок: ${pouchColor}`)
  return attributes
}

function formatVariantLabel(variant: VariantLike): string {
  const attributes = getVariantAttributes(variant)
  const sku = normalizeText(variant.sku)
  const fallback = sku ? `sku: ${sku}` : `id: ${variant.id.slice(0, 8)}`
  const details = attributes.length > 0 ? attributes.join(', ') : fallback
  return `${variant.product.name} (${variant.product.slug}) • ${details}`
}

function formatVariantButtonLabel(variant: VariantLike): string {
  const color = normalizeText(variant.color)
  const modelSize = normalizeText(variant.modelSize)
  const pouchColor = normalizeText(variant.pouchColor)
  const shortDetail = color ?? modelSize ?? pouchColor ?? normalizeText(variant.sku) ?? variant.id.slice(0, 8)
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

function chunkButtons<T>(items: T[], chunkSize: number): T[][] {
  const rows: T[][] = []
  for (let index = 0; index < items.length; index += chunkSize) {
    rows.push(items.slice(index, index + chunkSize))
  }
  return rows
}

function getOwnerUserIds(): string[] {
  return parseCsvIds(process.env.TELEGRAM_OWNER_USER_IDS)
}

function isOwner(userId: string): boolean {
  return getOwnerUserIds().includes(userId)
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

function parseSessionDraft(draftPayload: Prisma.JsonValue | null): SessionDraft {
  if (!draftPayload || typeof draftPayload !== 'object' || Array.isArray(draftPayload)) {
    return {}
  }

  const raw = draftPayload as Record<string, unknown>
  const next: SessionDraft = {}

  if (typeof raw.rateId === 'string' && raw.rateId.trim().length > 0) {
    next.rateId = raw.rateId.trim()
  }

  if (typeof raw.qty === 'number' && Number.isInteger(raw.qty) && raw.qty > 0) {
    next.qty = raw.qty
  }

  if (raw.ownerFlow === 'SET_RATE_AWAIT_RATE') {
    next.ownerFlow = 'SET_RATE_AWAIT_RATE'
  }

  if (typeof raw.ownerArtisanId === 'string' && raw.ownerArtisanId.trim().length > 0) {
    next.ownerArtisanId = raw.ownerArtisanId.trim()
  }

  if (typeof raw.ownerVariantId === 'string' && raw.ownerVariantId.trim().length > 0) {
    next.ownerVariantId = raw.ownerVariantId.trim()
  }

  return next
}

function buildSessionDraftJson(draft: SessionDraft): Prisma.JsonObject {
  const payload: Prisma.JsonObject = {}
  if (draft.rateId) payload.rateId = draft.rateId
  if (typeof draft.qty === 'number') payload.qty = draft.qty
  if (draft.ownerFlow) payload.ownerFlow = draft.ownerFlow
  if (draft.ownerArtisanId) payload.ownerArtisanId = draft.ownerArtisanId
  if (draft.ownerVariantId) payload.ownerVariantId = draft.ownerVariantId
  return payload
}

async function callTelegramApi<T = unknown>(method: string, payload: object): Promise<T | null> {
  const token = getBotToken()
  if (!token) {
    console.warn('[telegram-production] TELEGRAM_PRODUCTION_BOT_TOKEN is not configured')
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_API_TIMEOUT_MS)

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    const json = (await response.json().catch(() => null)) as
      | { ok?: boolean; result?: T; description?: string }
      | null

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

async function sendTelegramMessage(input: TelegramSendMessageInput): Promise<void> {
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
  const shouldUpdateUsername = artisan.telegramUsername !== (input.username ?? null)
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

function buildMasterHelpText() {
  return [
    '<b>Команди майстра</b>',
    '/register CODE - прив\'язати акаунт майстра',
    '/record - зафіксувати виробіток (обрати варіант)',
    '/qty 10 - ввести кількість після вибору варіанту',
    '/my - мій звіт за поточний місяць',
    '/help - підказка',
  ].join('\n')
}

function buildOwnerHelpText() {
  return [
    '<b>Команди власника</b>',
    '/new_master Ім\'я Прізвище',
    '/masters',
    '/set_rate CODE VARIANT_ID RATE',
    '/set_rate_bulk CODE RATE id1,id2,...',
    '/disable_rate CODE VARIANT_ID',
    '/rates CODE',
    '/rates_menu',
    '/products [query]',
    '/variants [query]',
    '/pending',
    '/report',
  ].join('\n')
}

function buildWhoAmIText(input: {
  userId: string
  chatId: string
  chatType: TelegramChat['type']
  username?: string
}): string {
  const ownerUserIds = getOwnerUserIds()
  const isOwnerUser = ownerUserIds.includes(input.userId)

  return [
    '<b>Who Am I</b>',
    `<b>user_id:</b> <code>${escapeHtml(input.userId)}</code>`,
    `<b>chat_id:</b> <code>${escapeHtml(input.chatId)}</code>`,
    `<b>chat_type:</b> <code>${escapeHtml(input.chatType)}</code>`,
    `<b>username:</b> ${escapeHtml(input.username ?? '(none)')}`,
    `<b>is_owner:</b> ${isOwnerUser ? 'yes' : 'no'}`,
    `<b>owners_env_count:</b> ${ownerUserIds.length}`,
    isOwnerUser
      ? 'Owner-доступ активний.'
      : 'Додайте цей user_id в TELEGRAM_OWNER_USER_IDS та redeploy.',
  ].join('\n')
}

function buildMainMenuKeyboard(isOwnerUser: boolean): TelegramReplyKeyboardButton[][] {
  const rows: TelegramReplyKeyboardButton[][] = [
    [{ text: MENU_BUTTONS.record }, { text: MENU_BUTTONS.my }],
    [{ text: MENU_BUTTONS.help }],
  ]

  if (!isOwnerUser) return rows

  rows.push(
    [{ text: MENU_BUTTONS.pending }, { text: MENU_BUTTONS.report }],
    [{ text: MENU_BUTTONS.products }, { text: MENU_BUTTONS.variants }],
    [{ text: MENU_BUTTONS.masters }, { text: MENU_BUTTONS.ratesMenu }],
  )

  return rows
}

function mapMenuButtonToCommand(text: string): string | null {
  if (text === MENU_BUTTONS.record) return 'record'
  if (text === MENU_BUTTONS.my) return 'my'
  if (text === MENU_BUTTONS.help) return 'help'
  if (text === MENU_BUTTONS.pending) return 'pending'
  if (text === MENU_BUTTONS.report) return 'report'
  if (text === MENU_BUTTONS.products) return 'products'
  if (text === MENU_BUTTONS.variants) return 'variants'
  if (text === MENU_BUTTONS.masters) return 'masters'
  if (text === MENU_BUTTONS.ratesMenu) return 'rates_menu'
  return null
}

async function sendOwnerRatesMenu(chatId: string) {
  await sendTelegramMessage({
    chatId,
    text: [
      '<b>Керування ставками</b>',
      'Обери дію кнопкою нижче.',
    ].join('\n'),
    inlineKeyboard: [
      [{ text: '➕ Встановити / оновити', callback_data: `${CALLBACK_PREFIX}:om:set` }],
      [{ text: '⛔️ Вимкнути ставку', callback_data: `${CALLBACK_PREFIX}:om:disable` }],
      [{ text: '📋 Ставки майстра', callback_data: `${CALLBACK_PREFIX}:om:list` }],
    ],
  })
}

async function sendOwnerArtisanPicker(input: {
  chatId: string
  mode: 'set' | 'disable' | 'list'
}) {
  const artisans = await prisma.artisan.findMany({
    where: { isActive: true },
    orderBy: [{ name: 'asc' }],
    select: {
      id: true,
      name: true,
      accessCode: true,
    },
    take: 30,
  })

  if (artisans.length === 0) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Немає активних майстрів.',
    })
    return
  }

  const actionByMode: Record<typeof input.mode, string> = {
    set: 'osa',
    disable: 'oda',
    list: 'ola',
  }

  const rows = artisans.map((artisan) => [
    {
      text: `${artisan.name} [${artisan.accessCode}]`,
      callback_data: `${CALLBACK_PREFIX}:${actionByMode[input.mode]}:${artisan.id}`,
    },
  ])

  rows.push([{ text: '↩️ Скасувати', callback_data: `${CALLBACK_PREFIX}:cancel` }])

  await sendTelegramMessage({
    chatId: input.chatId,
    text:
      input.mode === 'list'
        ? 'Оберіть майстра для перегляду ставок:'
        : 'Оберіть майстра:',
    inlineKeyboard: rows,
  })
}

async function sendOwnerVariantPicker(input: {
  chatId: string
  artisanId: string
  mode: 'set' | 'disable'
  page: number
}) {
  const artisan = await prisma.artisan.findUnique({
    where: { id: input.artisanId },
    select: { id: true, name: true },
  })

  if (!artisan) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Майстра не знайдено.',
    })
    return
  }

  const total = await prisma.productVariant.count()
  if (total === 0) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Варіантів не знайдено.',
    })
    return
  }

  const maxPage = Math.max(0, Math.ceil(total / OWNER_VARIANTS_PAGE_SIZE) - 1)
  const page = Math.min(Math.max(0, input.page), maxPage)

  const variants = await prisma.productVariant.findMany({
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
          sortCatalog: true,
        },
      },
    },
    orderBy: [
      { product: { sortCatalog: 'asc' } },
      { product: { name: 'asc' } },
      { color: 'asc' },
      { modelSize: 'asc' },
      { id: 'asc' },
    ],
    skip: page * OWNER_VARIANTS_PAGE_SIZE,
    take: OWNER_VARIANTS_PAGE_SIZE,
  })

  const pickAction = input.mode === 'set' ? 'osv' : 'odv'
  const pageAction = input.mode === 'set' ? 'osp' : 'odp'

  const rows: TelegramInlineKeyboardButton[][] = variants.map((variant) => [
    {
      text: formatVariantButtonLabel(variant),
      callback_data: `${CALLBACK_PREFIX}:${pickAction}:${input.artisanId}:${variant.id}`,
    },
  ])

  const nav: TelegramInlineKeyboardButton[] = []
  if (page > 0) {
    nav.push({
      text: '⬅️ Назад',
      callback_data: `${CALLBACK_PREFIX}:${pageAction}:${input.artisanId}:${page - 1}`,
    })
  }
  if (page < maxPage) {
    nav.push({
      text: 'Далі ➡️',
      callback_data: `${CALLBACK_PREFIX}:${pageAction}:${input.artisanId}:${page + 1}`,
    })
  }
  if (nav.length > 0) rows.push(nav)

  rows.push([{ text: '↩️ Скасувати', callback_data: `${CALLBACK_PREFIX}:cancel` }])

  await sendTelegramMessage({
    chatId: input.chatId,
    text: [
      `<b>Майстер:</b> ${escapeHtml(artisan.name)}`,
      input.mode === 'set'
        ? 'Оберіть варіант для встановлення ставки:'
        : 'Оберіть варіант для вимкнення ставки:',
      `Сторінка ${page + 1} з ${maxPage + 1}`,
    ].join('\n'),
    inlineKeyboard: rows,
  })
}

async function notifyOwnersAboutSubmission(input: {
  productionId: string
  targetChatId: string
}): Promise<void> {
  const production = await prisma.artisanProduction.findUnique({
    where: { id: input.productionId },
    include: {
      artisan: true,
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

  if (!production) return

  const text = [
    '🧵 <b>Новий виробіток</b>',
    `<b>Майстер:</b> ${escapeHtml(production.artisan.name)}`,
    `<b>Варіант:</b> ${escapeHtml(formatVariantLabel(production.variant))}`,
    `<b>Variant ID:</b> <code>${escapeHtml(production.variantId)}</code>`,
    `<b>К-сть:</b> ${production.qty}`,
    `<b>Ставка:</b> ${formatUAH(production.ratePerUnitSnapshotUAH)}`,
    `<b>Сума:</b> ${formatUAH(production.totalLaborUAH)}`,
    `<b>Дата:</b> ${escapeHtml(formatDateTime(production.producedAt))}`,
    `<b>ID:</b> <code>${production.id}</code>`,
  ].join('\n')

  await sendTelegramMessage({
    chatId: input.targetChatId,
    text,
    inlineKeyboard: [
      [
        {
          text: '✅ Підтвердити',
          callback_data: `${CALLBACK_PREFIX}:approve:${production.id}`,
        },
        {
          text: '❌ Відхилити',
          callback_data: `${CALLBACK_PREFIX}:reject:${production.id}`,
        },
      ],
    ],
  })
}

async function sendProductionStatusToArtisan(input: {
  productionId: string
  status: ArtisanProductionStatus
  comment: string
}) {
  const production = await prisma.artisanProduction.findUnique({
    where: { id: input.productionId },
    include: {
      artisan: true,
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

  if (!production?.artisan.telegramChatId) return

  const statusLabel: Record<ArtisanProductionStatus, string> = {
    SUBMITTED: 'Надіслано',
    APPROVED: 'Підтверджено',
    PAID: 'Оплачено',
    REJECTED: 'Відхилено',
  }

  const text = [
    `📌 <b>Оновлення запису ${escapeHtml(production.id)}</b>`,
    `<b>Статус:</b> ${escapeHtml(statusLabel[input.status])}`,
    `<b>Варіант:</b> ${escapeHtml(formatVariantLabel(production.variant))}`,
    `<b>Variant ID:</b> <code>${escapeHtml(production.variantId)}</code>`,
    `<b>К-сть:</b> ${production.qty}`,
    `<b>Сума:</b> ${formatUAH(production.totalLaborUAH)}`,
    `<b>Коментар:</b> ${escapeHtml(input.comment)}`,
  ].join('\n')

  await sendTelegramMessage({
    chatId: production.artisan.telegramChatId,
    text,
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
      text: 'Вкажи код у форматі: <code>/register CODE</code>',
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
      text: 'Цей код вже прив\'язаний до іншого Telegram акаунта. Звернись до власника.',
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
      'Тепер використовуй <code>/record</code>, далі <code>/qty N</code>.',
    ].join('\n'),
    replyKeyboard: buildMainMenuKeyboard(isOwner(input.userId)),
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
        'Цей Telegram не прив\'язаний до майстра.',
        'Надішли <code>/register CODE</code>, де CODE дає власник.',
      ].join('\n'),
    })
    return
  }

  const rates = await prisma.artisanRate.findMany({
    where: {
      artisanId: artisan.id,
      isActive: true,
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
    orderBy: {
      createdAt: 'desc',
    },
    take: 40,
  })

  if (rates.length === 0) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Для тебе ще не налаштовано ставок по виробах. Звернись до власника.',
    })
    return
  }

  const sessionKey = buildSessionKey({
    chatId: input.chatId,
    userId: input.userId,
    chatType: input.chatType,
  })

  await clearSession(sessionKey)

  const rows = chunkButtons(
    rates.map((rate) => ({
      text: `${formatVariantButtonLabel(rate.variant)} • ${formatUAH(rate.ratePerUnitUAH)}`,
      callback_data: `${CALLBACK_PREFIX}:rate:${rate.id}`,
    })),
    1,
  )

  rows.push([
    {
      text: 'Скасувати',
      callback_data: `${CALLBACK_PREFIX}:cancel`,
    },
  ])

  await sendTelegramMessage({
    chatId: input.chatId,
    text: 'Оберіть варіант, який виготовлено:',
    inlineKeyboard: rows,
  })
}

async function handleMyCommand(input: {
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
      text: 'Спочатку виконай <code>/register CODE</code>.',
    })
    return
  }

  const now = new Date()
  const periodFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodTo = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const records = await prisma.artisanProduction.findMany({
    where: {
      artisanId: artisan.id,
      producedAt: {
        gte: periodFrom,
        lt: periodTo,
      },
    },
  })

  const aggregates = records.reduce(
    (acc, record) => {
      const bucket = acc[record.status]
      bucket.count += 1
      bucket.qty += record.qty
      bucket.amount += record.totalLaborUAH
      return acc
    },
    {
      SUBMITTED: { count: 0, qty: 0, amount: 0 },
      APPROVED: { count: 0, qty: 0, amount: 0 },
      PAID: { count: 0, qty: 0, amount: 0 },
      REJECTED: { count: 0, qty: 0, amount: 0 },
    } as Record<ArtisanProductionStatus, { count: number; qty: number; amount: number }>,
  )

  const monthLabel = periodFrom.toLocaleDateString('uk-UA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  })

  await sendTelegramMessage({
    chatId: input.chatId,
    text: [
      `📊 <b>Мій звіт за ${escapeHtml(monthLabel)}</b>`,
      `Надіслано: ${aggregates.SUBMITTED.count} запис(ів), ${aggregates.SUBMITTED.qty} шт, ${formatUAH(aggregates.SUBMITTED.amount)}`,
      `Підтверджено: ${aggregates.APPROVED.count} запис(ів), ${aggregates.APPROVED.qty} шт, ${formatUAH(aggregates.APPROVED.amount)}`,
      `Оплачено: ${aggregates.PAID.count} запис(ів), ${aggregates.PAID.qty} шт, ${formatUAH(aggregates.PAID.amount)}`,
      `Відхилено: ${aggregates.REJECTED.count} запис(ів), ${aggregates.REJECTED.qty} шт, ${formatUAH(aggregates.REJECTED.amount)}`,
    ].join('\n'),
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
      text: 'Спочатку виконай <code>/register CODE</code>.',
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
      text: 'Немає активного вибору варіанту. Почни з <code>/record</code>.',
    })
    return
  }

  const qty = parseInteger(input.qtyRaw)
  if (!qty || qty > 5000) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Введи коректну кількість: <code>/qty 10</code> (від 1 до 5000).',
    })
    return
  }

  const draft = parseSessionDraft(session.draftPayload)
  if (!draft.rateId) {
    await clearSession(sessionKey)
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Сесія застаріла. Виконай <code>/record</code> ще раз.',
    })
    return
  }

  const rate = await prisma.artisanRate.findFirst({
    where: {
      id: draft.rateId,
      artisanId: artisan.id,
      isActive: true,
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

  if (!rate) {
    await clearSession(sessionKey)
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Ставка більше неактивна. Запусти <code>/record</code> знову.',
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
      rateId: rate.id,
      qty,
    },
  })

  await sendTelegramMessage({
    chatId: input.chatId,
    text: [
      'Підтверди запис:',
      `<b>Варіант:</b> ${escapeHtml(formatVariantLabel(rate.variant))}`,
      `<b>Variant ID:</b> <code>${escapeHtml(rate.variantId)}</code>`,
      `<b>К-сть:</b> ${qty}`,
      `<b>Ставка:</b> ${formatUAH(rate.ratePerUnitUAH)}`,
      `<b>Сума:</b> ${formatUAH(total)}`,
    ].join('\n'),
    inlineKeyboard: [
      [
        { text: '✅ Підтвердити', callback_data: `${CALLBACK_PREFIX}:confirm` },
        { text: '↩️ Скасувати', callback_data: `${CALLBACK_PREFIX}:cancel` },
      ],
    ],
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

  if (session.step === TelegramBotSessionStep.AWAITING_QTY && draft.ownerFlow === 'SET_RATE_AWAIT_RATE') {
    await processOwnerRateInput({
      chatId: input.chatId,
      userId: input.userId,
      qtyRaw: input.text,
      sessionKey,
      draft,
    })
    return
  }

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
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Натисни кнопку підтвердження або скасування нижче.',
    })
  }
}

async function sendArtisanRatesById(input: {
  chatId: string
  artisanId: string
}) {
  const artisan = await prisma.artisan.findUnique({
    where: {
      id: input.artisanId,
    },
    include: {
      rates: {
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
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
                  slug: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!artisan) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Майстра не знайдено.',
    })
    return
  }

  if (artisan.rates.length === 0) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: `Для ${escapeHtml(artisan.name)} ще немає ставок.`,
    })
    return
  }

  const lines = artisan.rates.map(
    (rate) =>
      `• ${rate.isActive ? '✅' : '⛔️'} <code>${escapeHtml(rate.variant.id)}</code> — ${escapeHtml(formatVariantLabel(rate.variant))} - ${formatUAH(rate.ratePerUnitUAH)}`,
  )

  await sendTelegramMessage({
    chatId: input.chatId,
    text: [`<b>Ставки майстра ${escapeHtml(artisan.name)}</b>`, ...lines].join('\n'),
  })
}

async function processOwnerRateInput(input: {
  chatId: string
  userId: string
  qtyRaw: string
  sessionKey: string
  draft: SessionDraft
}) {
  if (!isOwner(input.userId)) return
  const rate = parseInteger(input.qtyRaw)
  if (!rate || rate > 100000) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Введи коректну ставку числом (від 1 до 100000).',
    })
    return
  }

  if (!input.draft.ownerArtisanId || !input.draft.ownerVariantId) {
    await clearSession(input.sessionKey)
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Сесію ставки втрачено. Повтори через кнопку "💵 Ставки".',
    })
    return
  }

  const [artisan, variant] = await Promise.all([
    prisma.artisan.findUnique({
      where: { id: input.draft.ownerArtisanId },
      select: {
        id: true,
        name: true,
        accessCode: true,
      },
    }),
    prisma.productVariant.findUnique({
      where: { id: input.draft.ownerVariantId },
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
    }),
  ])

  if (!artisan || !variant) {
    await clearSession(input.sessionKey)
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Майстра або варіант не знайдено. Повтори через кнопку "💵 Ставки".',
    })
    return
  }

  await prisma.artisanRate.upsert({
    where: {
      artisanId_variantId: {
        artisanId: artisan.id,
        variantId: variant.id,
      },
    },
    create: {
      artisanId: artisan.id,
      variantId: variant.id,
      ratePerUnitUAH: rate,
      isActive: true,
    },
    update: {
      ratePerUnitUAH: rate,
      isActive: true,
    },
  })

  await clearSession(input.sessionKey)

  await sendTelegramMessage({
    chatId: input.chatId,
    text: [
      '✅ Ставка встановлена',
      `<b>Майстер:</b> ${escapeHtml(artisan.name)} (${escapeHtml(artisan.accessCode)})`,
      `<b>Варіант:</b> ${escapeHtml(formatVariantLabel(variant))}`,
      `<b>Variant ID:</b> <code>${escapeHtml(variant.id)}</code>`,
      `<b>Ставка:</b> ${formatUAH(rate)}`,
    ].join('\n'),
  })
}

async function handleOwnerCommand(input: {
  command: string
  args: string
  chatId: string
}) {
  const { command, args, chatId } = input

  if (command === 'new_master') {
    const name = args.trim()
    if (name.length < 2) {
      await sendTelegramMessage({
        chatId,
        text: 'Формат: <code>/new_master Ім\'я Прізвище</code>',
      })
      return
    }

    let created: Awaited<ReturnType<typeof prisma.artisan.create>> | null = null
    for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
      const accessCode = String(Math.floor(100000 + Math.random() * 900000))
      try {
        created = await prisma.artisan.create({
          data: {
            name,
            accessCode,
            isActive: true,
          },
        })
      } catch {
        created = null
      }
    }

    if (!created) {
      await sendTelegramMessage({
        chatId,
        text: 'Не вдалося створити майстра. Спробуй ще раз.',
      })
      return
    }

    await sendTelegramMessage({
      chatId,
      text: [
        `✅ Створено майстра: <b>${escapeHtml(created.name)}</b>`,
        `Код реєстрації: <code>${escapeHtml(created.accessCode)}</code>`,
        'Передай код майстру для команди <code>/register CODE</code>.',
      ].join('\n'),
    })
    return
  }

  if (command === 'set_rate') {
    const [codeRaw, variantIdRaw, rateRaw] = args.split(/\s+/)
    const code = codeRaw?.trim()
    const variantId = variantIdRaw?.trim()
    const rate = rateRaw ? parseInteger(rateRaw) : null

    if (!code || !variantId || !rate) {
      await sendTelegramMessage({
        chatId,
        text: 'Формат: <code>/set_rate CODE VARIANT_ID RATE</code>',
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

    if (!artisan) {
      await sendTelegramMessage({
        chatId,
        text: 'Майстра з таким кодом не знайдено.',
      })
      return
    }

    const variant = await prisma.productVariant.findUnique({
      where: {
        id: variantId,
      },
      select: {
        id: true,
        sku: true,
        color: true,
        modelSize: true,
        pouchColor: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    if (!variant) {
      await sendTelegramMessage({
        chatId,
        text: 'Варіант не знайдено. Перевір VARIANT_ID або використай /variants.',
      })
      return
    }

    await prisma.artisanRate.upsert({
      where: {
        artisanId_variantId: {
          artisanId: artisan.id,
          variantId: variant.id,
        },
      },
      create: {
        artisanId: artisan.id,
        variantId: variant.id,
        ratePerUnitUAH: rate,
        isActive: true,
      },
      update: {
        ratePerUnitUAH: rate,
        isActive: true,
      },
    })

    await sendTelegramMessage({
      chatId,
      text: [
        '✅ Ставка встановлена',
        `<b>Майстер:</b> ${escapeHtml(artisan.name)} (${escapeHtml(artisan.accessCode)})`,
        `<b>Варіант:</b> ${escapeHtml(formatVariantLabel(variant))}`,
        `<b>Variant ID:</b> <code>${escapeHtml(variant.id)}</code>`,
        `<b>Ставка:</b> ${formatUAH(rate)}`,
      ].join('\n'),
    })
    return
  }

  if (command === 'set_rate_bulk' || command === 'set_rates') {
    const [codeRaw, rateRaw, ...variantRawParts] = args.split(/\s+/)
    const code = codeRaw?.trim()
    const rate = rateRaw ? parseInteger(rateRaw) : null
    const variantIds = parseIdList(variantRawParts.join(' '))

    if (!code || !rate || variantIds.length === 0) {
      await sendTelegramMessage({
        chatId,
        text: [
          'Формат: <code>/set_rate_bulk CODE RATE id1,id2,id3</code>',
          'Приклад: <code>/set_rate_bulk 123456 450 cm7abc...,cm7def...,cm7ghi...</code>',
        ].join('\n'),
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
      select: {
        id: true,
        name: true,
        accessCode: true,
      },
    })

    if (!artisan) {
      await sendTelegramMessage({
        chatId,
        text: 'Майстра з таким кодом не знайдено.',
      })
      return
    }

    const variants = await prisma.productVariant.findMany({
      where: {
        id: {
          in: variantIds,
        },
      },
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
    })

    if (variants.length === 0) {
      await sendTelegramMessage({
        chatId,
        text: 'Жодного варіанта за переданими VARIANT_ID не знайдено.',
      })
      return
    }

    await prisma.$transaction(
      variants.map((variant) =>
        prisma.artisanRate.upsert({
          where: {
            artisanId_variantId: {
              artisanId: artisan.id,
              variantId: variant.id,
            },
          },
          create: {
            artisanId: artisan.id,
            variantId: variant.id,
            ratePerUnitUAH: rate,
            isActive: true,
          },
          update: {
            ratePerUnitUAH: rate,
            isActive: true,
          },
        }),
      ),
    )

    const foundVariantSet = new Set(variants.map((variant) => variant.id))
    const missingVariantIds = variantIds.filter((variantId) => !foundVariantSet.has(variantId))

    const appliedLines = variants
      .slice(0, 15)
      .map(
        (variant) =>
          `• <code>${escapeHtml(variant.id)}</code> — ${escapeHtml(formatVariantLabel(variant))}`,
      )
    const appliedMoreCount = Math.max(0, variants.length - appliedLines.length)

    await sendTelegramMessage({
      chatId,
      text: [
        '✅ Масове оновлення ставок виконано',
        `<b>Майстер:</b> ${escapeHtml(artisan.name)} (${escapeHtml(artisan.accessCode)})`,
        `<b>Ставка:</b> ${formatUAH(rate)}`,
        `<b>Оновлено варіантів:</b> ${variants.length}`,
        ...appliedLines,
        ...(appliedMoreCount > 0
          ? [`… та ще ${appliedMoreCount} варіант(ів)`]
          : []),
        ...(missingVariantIds.length > 0
          ? [
              '',
              `<b>Не знайдено VARIANT_ID:</b> ${missingVariantIds
                .slice(0, 15)
                .map((variantId) => `<code>${escapeHtml(variantId)}</code>`)
                .join(', ')}`,
            ]
          : []),
      ].join('\n'),
    })
    return
  }

  if (command === 'disable_rate') {
    const [codeRaw, variantIdRaw] = args.split(/\s+/)
    const code = codeRaw?.trim()
    const variantId = variantIdRaw?.trim()

    if (!code || !variantId) {
      await sendTelegramMessage({
        chatId,
        text: 'Формат: <code>/disable_rate CODE VARIANT_ID</code>',
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
      select: {
        id: true,
        name: true,
      },
    })

    if (!artisan) {
      await sendTelegramMessage({
        chatId,
        text: 'Майстра з таким кодом не знайдено.',
      })
      return
    }

    const variant = await prisma.productVariant.findUnique({
      where: {
        id: variantId,
      },
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
    })

    if (!variant) {
      await sendTelegramMessage({
        chatId,
        text: 'Варіант не знайдено.',
      })
      return
    }

    await prisma.artisanRate.updateMany({
      where: {
        artisanId: artisan.id,
        variantId: variant.id,
      },
      data: {
        isActive: false,
      },
    })

    await sendTelegramMessage({
      chatId,
      text: [
        `⛔️ Ставку вимкнено для ${escapeHtml(artisan.name)}.`,
        `<b>Варіант:</b> ${escapeHtml(formatVariantLabel(variant))}`,
        `<b>Variant ID:</b> <code>${escapeHtml(variant.id)}</code>`,
      ].join('\n'),
    })
    return
  }

  if (command === 'rates') {
    const code = args.trim()
    if (!code) {
      await sendTelegramMessage({
        chatId,
        text: 'Формат: <code>/rates CODE</code>',
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
      select: { id: true },
    })

    if (!artisan) {
      await sendTelegramMessage({
        chatId,
        text: 'Майстра не знайдено.',
      })
      return
    }

    await sendArtisanRatesById({
      chatId,
      artisanId: artisan.id,
    })
    return
  }

  if (command === 'masters') {
    const artisans = await prisma.artisan.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            rates: true,
            productions: true,
          },
        },
      },
      take: 50,
    })

    if (artisans.length === 0) {
      await sendTelegramMessage({
        chatId,
        text: 'Майстрів ще немає. Створи через <code>/new_master</code>.',
      })
      return
    }

    const lines = artisans.map((artisan) => {
      const linked = artisan.telegramUserId ? 'прив\'язано' : 'не прив\'язано'
      return `• ${artisan.isActive ? '✅' : '⛔️'} ${escapeHtml(artisan.name)} [${escapeHtml(artisan.accessCode)}] — ${linked}; ставок: ${artisan._count.rates}; записів: ${artisan._count.productions}`
    })

    await sendTelegramMessage({
      chatId,
      text: ['<b>Майстри</b>', ...lines].join('\n'),
    })
    return
  }

  if (command === 'products') {
    const query = args.trim()
    const products = await prisma.product.findMany({
      where: query
        ? {
            OR: [
              { slug: { contains: query, mode: 'insensitive' } },
              { name: { contains: query, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ sortCatalog: 'asc' }, { name: 'asc' }],
      select: {
        slug: true,
        name: true,
        _count: {
          select: {
            variants: true,
          },
        },
      },
      take: 30,
    })

    if (products.length === 0) {
      await sendTelegramMessage({
        chatId,
        text: 'Товарів не знайдено.',
      })
      return
    }

    await sendTelegramMessage({
      chatId,
      text: [
        '<b>Доступні товари (slug)</b>',
        ...products.map(
          (product) =>
            `• <code>${escapeHtml(product.slug)}</code> — ${escapeHtml(product.name)} (варіантів: ${product._count.variants})`,
        ),
        '',
        'Для ставок поштучно використовуй <code>/variants [query]</code> і передавай VARIANT_ID у /set_rate.',
      ].join('\n'),
    })
    return
  }

  if (command === 'variants') {
    const query = args.trim()
    const variants = await prisma.productVariant.findMany({
      where: query
        ? {
            OR: [
              { id: { contains: query, mode: 'insensitive' } },
              { sku: { contains: query, mode: 'insensitive' } },
              { color: { contains: query, mode: 'insensitive' } },
              { modelSize: { contains: query, mode: 'insensitive' } },
              { pouchColor: { contains: query, mode: 'insensitive' } },
              {
                product: {
                  is: {
                    slug: { contains: query, mode: 'insensitive' },
                  },
                },
              },
              {
                product: {
                  is: {
                    name: { contains: query, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : undefined,
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
      orderBy: [{ sortCatalog: 'asc' }, { id: 'asc' }],
      take: 40,
    })

    if (variants.length === 0) {
      await sendTelegramMessage({
        chatId,
        text: 'Варіантів не знайдено.',
      })
      return
    }

    await sendTelegramMessage({
      chatId,
      text: [
        '<b>Варіанти (VARIANT_ID)</b>',
        ...variants.map(
          (variant) =>
            `• <code>${escapeHtml(variant.id)}</code> — ${escapeHtml(formatVariantLabel(variant))}`,
        ),
      ].join('\n'),
    })
    return
  }

  if (command === 'pending') {
    const pending = await prisma.artisanProduction.findMany({
      where: {
        status: ArtisanProductionStatus.SUBMITTED,
      },
      include: {
        artisan: true,
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
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    })

    if (pending.length === 0) {
      await sendTelegramMessage({
        chatId,
        text: 'Немає записів у статусі SUBMITTED.',
      })
      return
    }

    for (const production of pending) {
      await sendTelegramMessage({
        chatId,
        text: [
          '🧾 <b>Очікує підтвердження</b>',
          `<b>Майстер:</b> ${escapeHtml(production.artisan.name)}`,
          `<b>Варіант:</b> ${escapeHtml(formatVariantLabel(production.variant))}`,
          `<b>Variant ID:</b> <code>${escapeHtml(production.variantId)}</code>`,
          `<b>К-сть:</b> ${production.qty}`,
          `<b>Сума:</b> ${formatUAH(production.totalLaborUAH)}`,
          `<b>ID:</b> <code>${production.id}</code>`,
        ].join('\n'),
        inlineKeyboard: [
          [
            {
              text: '✅ Підтвердити',
              callback_data: `${CALLBACK_PREFIX}:approve:${production.id}`,
            },
            {
              text: '❌ Відхилити',
              callback_data: `${CALLBACK_PREFIX}:reject:${production.id}`,
            },
          ],
        ],
      })
    }

    return
  }

  if (command === 'report') {
    const now = new Date()
    const periodFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodTo = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const rows = await prisma.artisanProduction.findMany({
      where: {
        producedAt: {
          gte: periodFrom,
          lt: periodTo,
        },
      },
      include: {
        artisan: {
          select: {
            name: true,
          },
        },
      },
    })

    const totalsByStatus = rows.reduce(
      (acc, row) => {
        acc[row.status] += row.totalLaborUAH
        return acc
      },
      {
        SUBMITTED: 0,
        APPROVED: 0,
        PAID: 0,
        REJECTED: 0,
      } as Record<ArtisanProductionStatus, number>,
    )

    const byArtisan = rows.reduce((acc, row) => {
      const key = row.artisan.name
      const current = acc.get(key) ?? 0
      acc.set(key, current + row.totalLaborUAH)
      return acc
    }, new Map<string, number>())

    const topArtisans = Array.from(byArtisan.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)

    const monthLabel = periodFrom.toLocaleDateString('uk-UA', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Kyiv',
    })

    const artisanLines =
      topArtisans.length > 0
        ? topArtisans.map(([name, amount]) => `• ${escapeHtml(name)} — ${formatUAH(amount)}`)
        : ['• Даних немає']

    await sendTelegramMessage({
      chatId,
      text: [
        `📈 <b>Звіт за ${escapeHtml(monthLabel)}</b>`,
        `SUBMITTED: ${formatUAH(totalsByStatus.SUBMITTED)}`,
        `APPROVED: ${formatUAH(totalsByStatus.APPROVED)}`,
        `PAID: ${formatUAH(totalsByStatus.PAID)}`,
        `REJECTED: ${formatUAH(totalsByStatus.REJECTED)}`,
        '',
        '<b>Топ майстрів за сумою:</b>',
        ...artisanLines,
      ].join('\n'),
    })
    return
  }

  if (command === 'rates_menu') {
    await sendOwnerRatesMenu(chatId)
    return
  }

  if (command === 'help' || command === 'start') {
    await sendTelegramMessage({
      chatId,
      text: buildOwnerHelpText(),
      replyKeyboard: buildMainMenuKeyboard(true),
    })
    return
  }

  await sendTelegramMessage({
    chatId,
    text: 'Невідома команда власника. Використай /help.',
  })
}

async function handleCommand(input: {
  command: string
  args: string
  chatId: string
  chatType: TelegramChat['type']
  userId: string
  username?: string
}) {
  const isOwnerUser = isOwner(input.userId)
  const ownerOnly = new Set([
    'new_master',
    'masters',
    'set_rate',
    'set_rate_bulk',
    'set_rates',
    'disable_rate',
    'rates',
    'rates_menu',
    'products',
    'variants',
    'pending',
    'report',
  ])

  if (input.command === 'help' || input.command === 'start') {
    const parts = [buildMasterHelpText()]
    if (isOwnerUser) {
      parts.push('')
      parts.push(buildOwnerHelpText())
    }

    await sendTelegramMessage({
      chatId: input.chatId,
      text: parts.join('\n'),
      replyKeyboard: buildMainMenuKeyboard(isOwnerUser),
    })
    return
  }

  if (input.command === 'whoami') {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: buildWhoAmIText({
        userId: input.userId,
        chatId: input.chatId,
        chatType: input.chatType,
        username: input.username,
      }),
    })
    return
  }

  if (ownerOnly.has(input.command) && !isOwnerUser) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: [
        'Недостатньо прав для цієї команди.',
        `Ваш user_id: <code>${escapeHtml(input.userId)}</code>`,
        'Додайте його в TELEGRAM_OWNER_USER_IDS і зробіть redeploy.',
      ].join('\n'),
    })
    return
  }

  if (isOwnerUser) {
    if (ownerOnly.has(input.command)) {
      await handleOwnerCommand({
        command: input.command,
        args: input.args,
        chatId: input.chatId,
      })
      return
    }
  }

  if (input.command === 'register') {
    await handleRegisterCommand({
      chatId: input.chatId,
      chatType: input.chatType,
      userId: input.userId,
      username: input.username,
      args: input.args,
    })
    return
  }

  if (input.command === 'record') {
    await handleRecordCommand({
      chatId: input.chatId,
      chatType: input.chatType,
      userId: input.userId,
      username: input.username,
    })
    return
  }

  if (input.command === 'qty') {
    if (!input.args.trim()) {
      await sendTelegramMessage({
        chatId: input.chatId,
        text: 'Формат: <code>/qty 10</code>',
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

  if (input.command === 'my') {
    await handleMyCommand({
      chatId: input.chatId,
      chatType: input.chatType,
      userId: input.userId,
      username: input.username,
    })
    return
  }

  await sendTelegramMessage({
    chatId: input.chatId,
    text: 'Невідома команда. Використай /help.',
  })
}

async function approveProduction(input: {
  productionId: string
  ownerUserId: string
  ownerChatId: string
  callbackQueryId: string
}) {
  const existing = await prisma.artisanProduction.findUnique({
    where: { id: input.productionId },
    include: {
      artisan: true,
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

  if (!existing) {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Запис не знайдено',
      showAlert: true,
    })
    return
  }

  if (existing.status === ArtisanProductionStatus.APPROVED) {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Вже підтверджено',
    })
    return
  }

  if (existing.status === ArtisanProductionStatus.PAID) {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Вже оплачено',
    })
    return
  }

  if (existing.status === ArtisanProductionStatus.REJECTED) {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Запис вже відхилено',
      showAlert: true,
    })
    return
  }

  const updated = await prisma.artisanProduction.update({
    where: { id: existing.id },
    data: {
      status: ArtisanProductionStatus.APPROVED,
      approvedAt: new Date(),
      approvedByTelegramUserId: input.ownerUserId,
    },
  })

  await answerCallbackQuery({
    callbackQueryId: input.callbackQueryId,
    text: 'Підтверджено',
  })

  await sendTelegramMessage({
    chatId: input.ownerChatId,
    text: [
      `✅ Підтверджено запис <code>${escapeHtml(updated.id)}</code>`,
      `<b>Майстер:</b> ${escapeHtml(existing.artisan.name)}`,
      `<b>Варіант:</b> ${escapeHtml(formatVariantLabel(existing.variant))}`,
      `<b>Variant ID:</b> <code>${escapeHtml(existing.variantId)}</code>`,
      `<b>Сума:</b> ${formatUAH(existing.totalLaborUAH)}`,
    ].join('\n'),
    inlineKeyboard: [
      [
        {
          text: '💸 Позначити виплату',
          callback_data: `${CALLBACK_PREFIX}:pay:${existing.id}`,
        },
      ],
    ],
  })

  await sendProductionStatusToArtisan({
    productionId: existing.id,
    status: ArtisanProductionStatus.APPROVED,
    comment: 'Підтверджено власником',
  })
}

async function rejectProduction(input: {
  productionId: string
  ownerChatId: string
  callbackQueryId: string
}) {
  const existing = await prisma.artisanProduction.findUnique({
    where: { id: input.productionId },
    include: {
      artisan: true,
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

  if (!existing) {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Запис не знайдено',
      showAlert: true,
    })
    return
  }

  if (existing.status === ArtisanProductionStatus.REJECTED) {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Вже відхилено',
    })
    return
  }

  if (existing.status === ArtisanProductionStatus.PAID) {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Запис уже оплачено, відхилення неможливе',
      showAlert: true,
    })
    return
  }

  await prisma.artisanProduction.update({
    where: { id: existing.id },
    data: {
      status: ArtisanProductionStatus.REJECTED,
    },
  })

  await answerCallbackQuery({
    callbackQueryId: input.callbackQueryId,
    text: 'Відхилено',
  })

  await sendTelegramMessage({
    chatId: input.ownerChatId,
    text: [
      `❌ Запис <code>${escapeHtml(existing.id)}</code> відхилено.`,
      `<b>Варіант:</b> ${escapeHtml(formatVariantLabel(existing.variant))}`,
      `<b>Variant ID:</b> <code>${escapeHtml(existing.variantId)}</code>`,
    ].join('\n'),
  })

  await sendProductionStatusToArtisan({
    productionId: existing.id,
    status: ArtisanProductionStatus.REJECTED,
    comment: 'Відхилено власником',
  })
}

async function payProduction(input: {
  productionId: string
  ownerChatId: string
  callbackQueryId: string
}) {
  const result = await prisma.$transaction(async (tx) => {
    const production = await tx.artisanProduction.findUnique({
      where: { id: input.productionId },
      include: {
        artisan: true,
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

    if (!production) {
      return { kind: 'not_found' as const }
    }

    if (production.status === ArtisanProductionStatus.PAID) {
      return {
        kind: 'already_paid' as const,
        production,
      }
    }

    if (production.status !== ArtisanProductionStatus.APPROVED) {
      return {
        kind: 'invalid_status' as const,
        production,
      }
    }

    const expense = await tx.expense.create({
      data: {
        title: `Оплата роботи: ${production.artisan.name} (${production.variant.product.name})`,
        category: ExpenseCategory.PAYROLL,
        amountUAH: production.totalLaborUAH,
        expenseDate: new Date(),
        notes: [
          'Створено Telegram production bot',
          `productionId=${production.id}`,
          `variantId=${production.variantId}`,
          `variant=${formatVariantLabel(production.variant)}`,
          `qty=${production.qty}`,
          `rate=${production.ratePerUnitSnapshotUAH}`,
        ].join('\n'),
      },
    })

    const updated = await tx.artisanProduction.update({
      where: { id: production.id },
      data: {
        status: ArtisanProductionStatus.PAID,
        paidAt: new Date(),
        paidExpenseId: expense.id,
      },
      include: {
        artisan: true,
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

    return {
      kind: 'paid' as const,
      production: updated,
      expense,
    }
  })

  if (result.kind === 'not_found') {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Запис не знайдено',
      showAlert: true,
    })
    return
  }

  if (result.kind === 'already_paid') {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Вже оплачено',
      showAlert: true,
    })
    return
  }

  if (result.kind === 'invalid_status') {
    await answerCallbackQuery({
      callbackQueryId: input.callbackQueryId,
      text: 'Оплата можлива тільки для APPROVED записів',
      showAlert: true,
    })
    return
  }

  await answerCallbackQuery({
    callbackQueryId: input.callbackQueryId,
    text: 'Оплату зафіксовано',
  })

  await sendTelegramMessage({
    chatId: input.ownerChatId,
    text: [
      '💸 <b>Виплату зафіксовано</b>',
      `<b>Запис:</b> <code>${escapeHtml(result.production.id)}</code>`,
      `<b>Майстер:</b> ${escapeHtml(result.production.artisan.name)}`,
      `<b>Варіант:</b> ${escapeHtml(formatVariantLabel(result.production.variant))}`,
      `<b>Variant ID:</b> <code>${escapeHtml(result.production.variantId)}</code>`,
      `<b>Сума:</b> ${formatUAH(result.production.totalLaborUAH)}`,
      `<b>Expense ID:</b> <code>${escapeHtml(result.expense.id)}</code>`,
    ].join('\n'),
  })

  await sendProductionStatusToArtisan({
    productionId: result.production.id,
    status: ArtisanProductionStatus.PAID,
    comment: 'Виплату позначено як проведену',
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
  const arg2 = parts[3] ?? ''
  const message = callback.message
  const chatId = message?.chat?.id ? toTelegramId(message.chat.id) : null
  const chatType = message?.chat?.type
  const sessionKey =
    chatId && chatType
      ? buildSessionKey({ chatId, userId: fromUserId, chatType })
      : null

  if (action === 'approve' || action === 'reject' || action === 'pay') {
    if (!isOwner(fromUserId)) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Недостатньо прав для цієї дії',
        showAlert: true,
      })
      return
    }

    const ownerChatId = callback.message?.chat?.id
    if (!ownerChatId || !arg1) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Некоректний callback payload',
        showAlert: true,
      })
      return
    }

    if (action === 'approve') {
      await approveProduction({
        productionId: arg1,
        ownerUserId: fromUserId,
        ownerChatId: toTelegramId(ownerChatId),
        callbackQueryId: callback.id,
      })
      return
    }

    if (action === 'reject') {
      await rejectProduction({
        productionId: arg1,
        ownerChatId: toTelegramId(ownerChatId),
        callbackQueryId: callback.id,
      })
      return
    }

    await payProduction({
      productionId: arg1,
      ownerChatId: toTelegramId(ownerChatId),
      callbackQueryId: callback.id,
    })
    return
  }

  if (
    action === 'om' ||
    action === 'osa' ||
    action === 'oda' ||
    action === 'ola' ||
    action === 'osp' ||
    action === 'odp' ||
    action === 'osv' ||
    action === 'odv'
  ) {
    if (!isOwner(fromUserId)) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Недостатньо прав',
        showAlert: true,
      })
      return
    }

    if (!chatId || !chatType || !sessionKey) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Сесію не знайдено',
        showAlert: true,
      })
      return
    }

    if (action === 'om') {
      if (arg1 === 'set') {
        await answerCallbackQuery({ callbackQueryId: callback.id, text: 'Оберіть майстра' })
        await sendOwnerArtisanPicker({ chatId, mode: 'set' })
        return
      }
      if (arg1 === 'disable') {
        await answerCallbackQuery({ callbackQueryId: callback.id, text: 'Оберіть майстра' })
        await sendOwnerArtisanPicker({ chatId, mode: 'disable' })
        return
      }
      if (arg1 === 'list') {
        await answerCallbackQuery({ callbackQueryId: callback.id, text: 'Оберіть майстра' })
        await sendOwnerArtisanPicker({ chatId, mode: 'list' })
        return
      }

      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Невідома дія',
        showAlert: true,
      })
      return
    }

    if (action === 'osa' && arg1) {
      await answerCallbackQuery({ callbackQueryId: callback.id, text: 'Оберіть варіант' })
      await sendOwnerVariantPicker({
        chatId,
        artisanId: arg1,
        mode: 'set',
        page: 0,
      })
      return
    }

    if (action === 'oda' && arg1) {
      await answerCallbackQuery({ callbackQueryId: callback.id, text: 'Оберіть варіант' })
      await sendOwnerVariantPicker({
        chatId,
        artisanId: arg1,
        mode: 'disable',
        page: 0,
      })
      return
    }

    if (action === 'ola' && arg1) {
      await answerCallbackQuery({ callbackQueryId: callback.id, text: 'Показую ставки' })
      await sendArtisanRatesById({
        chatId,
        artisanId: arg1,
      })
      return
    }

    if ((action === 'osp' || action === 'odp') && arg1) {
      const page = Number.parseInt(arg2 || '0', 10)
      await answerCallbackQuery({ callbackQueryId: callback.id, text: 'Сторінка' })
      await sendOwnerVariantPicker({
        chatId,
        artisanId: arg1,
        mode: action === 'osp' ? 'set' : 'disable',
        page: Number.isFinite(page) ? page : 0,
      })
      return
    }

    if (action === 'osv' && arg1 && arg2) {
      const [artisan, variant] = await Promise.all([
        prisma.artisan.findUnique({
          where: { id: arg1 },
          select: {
            id: true,
            name: true,
            accessCode: true,
          },
        }),
        prisma.productVariant.findUnique({
          where: { id: arg2 },
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
        }),
      ])

      if (!artisan || !variant) {
        await answerCallbackQuery({
          callbackQueryId: callback.id,
          text: 'Майстра або варіант не знайдено',
          showAlert: true,
        })
        return
      }

      await setSession({
        sessionKey,
        userId: fromUserId,
        step: TelegramBotSessionStep.AWAITING_QTY,
        draft: {
          ownerFlow: 'SET_RATE_AWAIT_RATE',
          ownerArtisanId: artisan.id,
          ownerVariantId: variant.id,
        },
      })

      await answerCallbackQuery({ callbackQueryId: callback.id, text: 'Варіант обрано' })
      await sendTelegramMessage({
        chatId,
        text: [
          '<b>Встановлення ставки</b>',
          `<b>Майстер:</b> ${escapeHtml(artisan.name)} (${escapeHtml(artisan.accessCode)})`,
          `<b>Варіант:</b> ${escapeHtml(formatVariantLabel(variant))}`,
          `<b>Variant ID:</b> <code>${escapeHtml(variant.id)}</code>`,
          'Надішліть суму за 1 шт одним числом (наприклад: <code>450</code>).',
        ].join('\n'),
      })
      return
    }

    if (action === 'odv' && arg1 && arg2) {
      const [artisan, variant, result] = await Promise.all([
        prisma.artisan.findUnique({
          where: { id: arg1 },
          select: { name: true },
        }),
        prisma.productVariant.findUnique({
          where: { id: arg2 },
          select: {
            id: true,
            sku: true,
            color: true,
            modelSize: true,
            pouchColor: true,
            product: {
              select: { name: true, slug: true },
            },
          },
        }),
        prisma.artisanRate.updateMany({
          where: {
            artisanId: arg1,
            variantId: arg2,
            isActive: true,
          },
          data: {
            isActive: false,
          },
        }),
      ])

      if (!artisan || !variant) {
        await answerCallbackQuery({
          callbackQueryId: callback.id,
          text: 'Майстра або варіант не знайдено',
          showAlert: true,
        })
        return
      }

      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: result.count > 0 ? 'Ставку вимкнено' : 'Активної ставки не було',
      })

      await sendTelegramMessage({
        chatId,
        text: [
          result.count > 0 ? '⛔️ Ставку вимкнено' : 'ℹ️ Активної ставки не було',
          `<b>Майстер:</b> ${escapeHtml(artisan.name)}`,
          `<b>Варіант:</b> ${escapeHtml(formatVariantLabel(variant))}`,
          `<b>Variant ID:</b> <code>${escapeHtml(variant.id)}</code>`,
        ].join('\n'),
      })
      return
    }

    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Некоректна owner-дія',
      showAlert: true,
    })
    return
  }

  if (!message?.chat?.id || !chatId || !chatType || !sessionKey) {
    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Сесія не знайдена',
      showAlert: true,
    })
    return
  }

  const userId = fromUserId

  if (action === 'cancel') {
    await clearSession(sessionKey)
    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Скасовано',
    })
    await sendTelegramMessage({
      chatId,
      text: 'Дію скасовано. Для нового запису використовуй <code>/record</code>.',
    })
    return
  }

  if (action === 'rate') {
    const artisan = await findLinkedArtisanByTelegram({
      userId,
      chatId,
      chatType,
      username: callback.from.username,
    })

    if (!artisan) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Спочатку виконай /register CODE',
        showAlert: true,
      })
      return
    }

    const rateId = arg1 || ''
    const rate = await prisma.artisanRate.findFirst({
      where: {
        id: rateId,
        artisanId: artisan.id,
        isActive: true,
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

    if (!rate) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Ставка недоступна',
        showAlert: true,
      })
      return
    }

    await setSession({
      sessionKey,
      userId,
      artisanId: artisan.id,
      step: TelegramBotSessionStep.AWAITING_QTY,
      draft: {
        rateId: rate.id,
      },
    })

    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Вибрано',
    })

    await sendTelegramMessage({
      chatId,
      text: [
        `Обрано: <b>${escapeHtml(formatVariantLabel(rate.variant))}</b>`,
        `<b>Variant ID:</b> <code>${escapeHtml(rate.variantId)}</code>`,
        `Ставка: <b>${formatUAH(rate.ratePerUnitUAH)}</b>`,
        'Тепер надішли <code>/qty N</code> (наприклад, <code>/qty 7</code>).',
      ].join('\n'),
    })
    return
  }

  if (action === 'confirm') {
    const artisan = await findLinkedArtisanByTelegram({
      userId,
      chatId,
      chatType,
      username: callback.from.username,
    })

    if (!artisan) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Спочатку виконай /register CODE',
        showAlert: true,
      })
      return
    }

    const session = await getSession(sessionKey)
    if (!session || session.step !== TelegramBotSessionStep.AWAITING_CONFIRM) {
      await clearSession(sessionKey)
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Сесія застаріла. Запусти /record ще раз.',
        showAlert: true,
      })
      return
    }

    const draft = parseSessionDraft(session.draftPayload)
    if (!draft.rateId || !draft.qty) {
      await clearSession(sessionKey)
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Сесія неповна. Запусти /record ще раз.',
        showAlert: true,
      })
      return
    }

    const rate = await prisma.artisanRate.findFirst({
      where: {
        id: draft.rateId,
        artisanId: artisan.id,
        isActive: true,
      },
      include: {
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
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    })

    if (!rate) {
      await clearSession(sessionKey)
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Ставка більше недоступна. Повтори /record.',
        showAlert: true,
      })
      return
    }

    const production = await prisma.artisanProduction.create({
      data: {
        artisanId: artisan.id,
        productId: rate.variant.productId,
        variantId: rate.variantId,
        rateId: rate.id,
        qty: draft.qty,
        ratePerUnitSnapshotUAH: rate.ratePerUnitUAH,
        totalLaborUAH: draft.qty * rate.ratePerUnitUAH,
        status: ArtisanProductionStatus.SUBMITTED,
        source: 'TELEGRAM_BOT',
        telegramUpdateId: callback.message?.message_id,
      },
    })

    await clearSession(sessionKey)

    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Запис збережено',
    })

    await sendTelegramMessage({
      chatId,
      text: [
        '✅ Запис збережено та надіслано на підтвердження.',
        `<b>Варіант:</b> ${escapeHtml(formatVariantLabel(rate.variant))}`,
        `<b>Variant ID:</b> <code>${escapeHtml(rate.variantId)}</code>`,
        `<b>К-сть:</b> ${production.qty}`,
        `<b>Сума:</b> ${formatUAH(production.totalLaborUAH)}`,
        `<b>ID:</b> <code>${production.id}</code>`,
      ].join('\n'),
    })

    await notifyOwnersAboutSubmission({
      productionId: production.id,
      targetChatId: chatId,
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

export async function handleTelegramProductionUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query)
    return
  }

  if (update.message) {
    await handleMessage(update.message)
  }
}
