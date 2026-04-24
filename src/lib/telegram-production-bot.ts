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

type TelegramSendMessageInput = {
  chatId: string
  text: string
  inlineKeyboard?: TelegramInlineKeyboardButton[][]
}

type SessionDraft = {
  rateId?: string
  qty?: number
}

const TELEGRAM_API_TIMEOUT_MS = 4500
const CALLBACK_PREFIX = 'prod'

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

  return next
}

function buildSessionDraftJson(draft: SessionDraft): Prisma.JsonObject {
  const payload: Prisma.JsonObject = {}
  if (draft.rateId) payload.rateId = draft.rateId
  if (typeof draft.qty === 'number') payload.qty = draft.qty
  return payload
}

function parseInteger(input: string): number | null {
  const normalized = input.replace(/\s+/g, '')
  if (!/^\d+$/.test(normalized)) return null
  const parsed = Number(normalized)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function parseCommand(text: string): { command: string; args: string } | null {
  if (!text.startsWith('/')) return null
  const trimmed = text.trim()
  const firstSpace = trimmed.indexOf(' ')
  const commandPart = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)
  const args = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1).trim()

  const command = commandPart.slice(1).split('@')[0]?.trim().toLowerCase() || ''
  if (!command) return null

  return {
    command,
    args,
  }
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

async function getOwnerChatIds(): Promise<string[]> {
  const explicit = parseCsvIds(process.env.TELEGRAM_PRODUCTION_OWNER_CHAT_IDS)
  const fallback = parseCsvIds(process.env.TELEGRAM_CHAT_ID)
  const ownerUserIds = getOwnerUserIds()

  if (ownerUserIds.length === 0) {
    return Array.from(new Set([...explicit, ...fallback]))
  }

  const discoveredSessions = await prisma.telegramBotSession.findMany({
    where: {
      userId: { in: ownerUserIds },
    },
    select: {
      chatId: true,
    },
    take: 100,
  })

  const discovered = discoveredSessions
    .map((session) => session.chatId.trim())
    .filter(Boolean)

  return Array.from(new Set([...explicit, ...fallback, ...discovered]))
}

function isOwner(userId: string): boolean {
  const owners = getOwnerUserIds()
  return owners.includes(userId)
}

async function rememberOwnerChat(input: { userId: string; chatId: string }) {
  if (!isOwner(input.userId)) return

  await prisma.telegramBotSession.upsert({
    where: { chatId: input.chatId },
    create: {
      chatId: input.chatId,
      userId: input.userId,
      step: TelegramBotSessionStep.IDLE,
      draftPayload: {},
    },
    update: {
      userId: input.userId,
    },
  })
}

function getBotToken(): string | null {
  const token =
    process.env.TELEGRAM_PRODUCTION_BOT_TOKEN?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim()
  return token || null
}

async function callTelegramApi<T = unknown>(method: string, payload: object): Promise<T | null> {
  const token = getBotToken()
  if (!token) {
    console.warn('[telegram-production] TELEGRAM_BOT_TOKEN is not configured')
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
  username?: string
}) {
  const artisan = await prisma.artisan.findFirst({
    where: {
      isActive: true,
      OR: [{ telegramUserId: input.userId }, { telegramChatId: input.chatId }],
    },
  })

  if (!artisan) return null

  const needsUpdate =
    artisan.telegramUserId !== input.userId ||
    artisan.telegramChatId !== input.chatId ||
    artisan.telegramUsername !== (input.username ?? null)

  if (needsUpdate) {
    return prisma.artisan.update({
      where: { id: artisan.id },
      data: {
        telegramUserId: input.userId,
        telegramChatId: input.chatId,
        telegramUsername: input.username ?? null,
      },
    })
  }

  return artisan
}

async function setSession(input: {
  chatId: string
  userId?: string
  artisanId?: string
  step: TelegramBotSessionStep
  draft?: SessionDraft
}) {
  await prisma.telegramBotSession.upsert({
    where: { chatId: input.chatId },
    create: {
      chatId: input.chatId,
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

async function clearSession(chatId: string) {
  await setSession({
    chatId,
    step: TelegramBotSessionStep.IDLE,
    draft: {},
  })
}

async function getSession(chatId: string) {
  return prisma.telegramBotSession.findUnique({ where: { chatId } })
}

function buildMasterHelpText() {
  return [
    '<b>Команди майстра</b>',
    '/register CODE - прив\'язати акаунт майстра',
    '/record - зафіксувати виробіток',
    '/my - мій звіт за поточний місяць',
    '/help - підказка',
  ].join('\n')
}

function buildOwnerHelpText() {
  return [
    '<b>Команди власника</b>',
    '/new_master Ім\'я Прізвище',
    '/masters',
    '/set_rate CODE PRODUCT_SLUG RATE',
    '/disable_rate CODE PRODUCT_SLUG',
    '/rates CODE',
    '/products [query]',
    '/pending',
    '/report',
  ].join('\n')
}

async function notifyOwnersAboutSubmission(productionId: string): Promise<void> {
  const production = await prisma.artisanProduction.findUnique({
    where: { id: productionId },
    include: {
      artisan: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })

  if (!production) return

  const ownerChatIds = await getOwnerChatIds()
  if (ownerChatIds.length === 0) {
    console.warn(
      '[telegram-production] no owner chats configured. Set TELEGRAM_PRODUCTION_OWNER_CHAT_IDS or run any owner command (/pending, /report, /help) in a target chat first.',
    )
    return
  }

  const text = [
    '🧵 <b>Новий виробіток</b>',
    `<b>Майстер:</b> ${escapeHtml(production.artisan.name)}`,
    `<b>Виріб:</b> ${escapeHtml(production.product.name)} (${escapeHtml(production.product.slug)})`,
    `<b>К-сть:</b> ${production.qty}`,
    `<b>Ставка:</b> ${formatUAH(production.ratePerUnitSnapshotUAH)}`,
    `<b>Сума:</b> ${formatUAH(production.totalLaborUAH)}`,
    `<b>Дата:</b> ${escapeHtml(formatDateTime(production.producedAt))}`,
    `<b>ID:</b> <code>${production.id}</code>`,
  ].join('\n')

  const keyboard: TelegramInlineKeyboardButton[][] = [
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
  ]

  await Promise.all(
    ownerChatIds.map((chatId) =>
      sendTelegramMessage({
        chatId,
        text,
        inlineKeyboard: keyboard,
      }),
    ),
  )
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
      product: {
        select: {
          name: true,
          slug: true,
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
    `<b>Виріб:</b> ${escapeHtml(production.product.name)} (${escapeHtml(production.product.slug)})`,
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
      telegramChatId: input.chatId,
      telegramUsername: input.username ?? null,
    },
  })

  await clearSession(input.chatId)

  await sendTelegramMessage({
    chatId: input.chatId,
    text: [
      `✅ Майстра <b>${escapeHtml(updated.name)}</b> успішно прив\'язано.`,
      'Тепер використовуй <code>/record</code> для фіксації виробітку.',
    ].join('\n'),
  })
}

async function handleRecordCommand(input: {
  chatId: string
  userId: string
  username?: string
}) {
  const artisan = await findLinkedArtisanByTelegram({
    userId: input.userId,
    chatId: input.chatId,
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
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: {
      product: {
        name: 'asc',
      },
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

  await clearSession(input.chatId)

  const rows = chunkButtons(
    rates.map((rate) => ({
      text: `${rate.product.name} • ${formatUAH(rate.ratePerUnitUAH)}`,
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
    text: 'Оберіть виріб, який виготовлено:',
    inlineKeyboard: rows,
  })
}

async function handleMyCommand(input: {
  chatId: string
  userId: string
  username?: string
}) {
  const artisan = await findLinkedArtisanByTelegram({
    userId: input.userId,
    chatId: input.chatId,
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

async function handleMasterFreeText(input: {
  chatId: string
  userId: string
  username?: string
  text: string
}) {
  const artisan = await findLinkedArtisanByTelegram({
    userId: input.userId,
    chatId: input.chatId,
    username: input.username,
  })

  if (!artisan) return

  const session = await getSession(input.chatId)
  if (!session || session.step === TelegramBotSessionStep.IDLE) return

  const draft = parseSessionDraft(session.draftPayload)

  if (session.step === TelegramBotSessionStep.AWAITING_QTY) {
    const qty = parseInteger(input.text)
    if (!qty || qty > 5000) {
      await sendTelegramMessage({
        chatId: input.chatId,
        text: 'Введи коректну кількість (ціле число від 1 до 5000).',
      })
      return
    }

    if (!draft.rateId) {
      await clearSession(input.chatId)
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
        product: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    })

    if (!rate) {
      await clearSession(input.chatId)
      await sendTelegramMessage({
        chatId: input.chatId,
        text: 'Ставка більше неактивна. Запусти <code>/record</code> знову.',
      })
      return
    }

    const total = qty * rate.ratePerUnitUAH

    await setSession({
      chatId: input.chatId,
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
        `<b>Виріб:</b> ${escapeHtml(rate.product.name)} (${escapeHtml(rate.product.slug)})`,
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

    return
  }

  if (session.step === TelegramBotSessionStep.AWAITING_CONFIRM) {
    await sendTelegramMessage({
      chatId: input.chatId,
      text: 'Натисни кнопку підтвердження або скасування нижче.',
    })
  }
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

    let created = null as Awaited<ReturnType<typeof prisma.artisan.create>> | null
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
    const [codeRaw, slugRaw, rateRaw] = args.split(/\s+/)
    const code = codeRaw?.trim()
    const slug = slugRaw?.trim()
    const rate = rateRaw ? parseInteger(rateRaw) : null

    if (!code || !slug || !rate) {
      await sendTelegramMessage({
        chatId,
        text: 'Формат: <code>/set_rate CODE PRODUCT_SLUG RATE</code>',
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

    const product = await prisma.product.findFirst({
      where: {
        slug: {
          equals: slug,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    })

    if (!product) {
      await sendTelegramMessage({
        chatId,
        text: 'Товар не знайдено. Перевір slug або використай /products.',
      })
      return
    }

    await prisma.artisanRate.upsert({
      where: {
        artisanId_productId: {
          artisanId: artisan.id,
          productId: product.id,
        },
      },
      create: {
        artisanId: artisan.id,
        productId: product.id,
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
        `✅ Ставка встановлена`,
        `<b>Майстер:</b> ${escapeHtml(artisan.name)} (${escapeHtml(artisan.accessCode)})`,
        `<b>Виріб:</b> ${escapeHtml(product.name)} (${escapeHtml(product.slug)})`,
        `<b>Ставка:</b> ${formatUAH(rate)}`,
      ].join('\n'),
    })
    return
  }

  if (command === 'disable_rate') {
    const [codeRaw, slugRaw] = args.split(/\s+/)
    const code = codeRaw?.trim()
    const slug = slugRaw?.trim()

    if (!code || !slug) {
      await sendTelegramMessage({
        chatId,
        text: 'Формат: <code>/disable_rate CODE PRODUCT_SLUG</code>',
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

    const product = await prisma.product.findFirst({
      where: {
        slug: {
          equals: slug,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    })

    if (!product) {
      await sendTelegramMessage({
        chatId,
        text: 'Товар не знайдено.',
      })
      return
    }

    await prisma.artisanRate.updateMany({
      where: {
        artisanId: artisan.id,
        productId: product.id,
      },
      data: {
        isActive: false,
      },
    })

    await sendTelegramMessage({
      chatId,
      text: `⛔️ Ставку вимкнено для ${escapeHtml(artisan.name)} по ${escapeHtml(product.slug)}.`,
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
      include: {
        rates: {
          orderBy: {
            product: {
              name: 'asc',
            },
          },
          include: {
            product: {
              select: {
                slug: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!artisan) {
      await sendTelegramMessage({
        chatId,
        text: 'Майстра не знайдено.',
      })
      return
    }

    if (artisan.rates.length === 0) {
      await sendTelegramMessage({
        chatId,
        text: `Для ${escapeHtml(artisan.name)} ще немає ставок.`,
      })
      return
    }

    const lines = artisan.rates.map(
      (rate) =>
        `• ${rate.isActive ? '✅' : '⛔️'} ${escapeHtml(rate.product.slug)} (${escapeHtml(rate.product.name)}) - ${formatUAH(rate.ratePerUnitUAH)}`,
    )

    await sendTelegramMessage({
      chatId,
      text: [`<b>Ставки майстра ${escapeHtml(artisan.name)}</b>`, ...lines].join('\n'),
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
      text: ['<b>Доступні товари (slug)</b>', ...products.map((product) => `• <code>${escapeHtml(product.slug)}</code> — ${escapeHtml(product.name)}`)].join('\n'),
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
        product: {
          select: {
            name: true,
            slug: true,
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
          `<b>Виріб:</b> ${escapeHtml(production.product.name)} (${escapeHtml(production.product.slug)})`,
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

  if (command === 'help' || command === 'start') {
    await sendTelegramMessage({
      chatId,
      text: buildOwnerHelpText(),
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

  if (isOwnerUser) {
    await rememberOwnerChat({
      userId: input.userId,
      chatId: input.chatId,
    })
  }

  if (input.command === 'help' || input.command === 'start') {
    const parts = [buildMasterHelpText()]
    if (isOwnerUser) {
      parts.push('')
      parts.push(buildOwnerHelpText())
    }

    await sendTelegramMessage({
      chatId: input.chatId,
      text: parts.join('\n'),
    })
    return
  }

  if (isOwnerUser) {
    const ownerOnly = new Set([
      'new_master',
      'masters',
      'set_rate',
      'disable_rate',
      'rates',
      'products',
      'pending',
      'report',
    ])

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
    if (input.chatType !== 'private') {
      await sendTelegramMessage({
        chatId: input.chatId,
        text: 'Для реєстрації майстра напиши цю команду боту в приватному чаті.',
      })
      return
    }

    await handleRegisterCommand({
      chatId: input.chatId,
      userId: input.userId,
      username: input.username,
      args: input.args,
    })
    return
  }

  if (input.command === 'record') {
    if (input.chatType !== 'private') {
      await sendTelegramMessage({
        chatId: input.chatId,
        text: 'Фіксація виробітку доступна тільки в приватному чаті з ботом.',
      })
      return
    }

    await handleRecordCommand({
      chatId: input.chatId,
      userId: input.userId,
      username: input.username,
    })
    return
  }

  if (input.command === 'my') {
    if (input.chatType !== 'private') {
      await sendTelegramMessage({
        chatId: input.chatId,
        text: 'Команда /my доступна тільки в приватному чаті з ботом.',
      })
      return
    }

    await handleMyCommand({
      chatId: input.chatId,
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
      product: {
        select: {
          name: true,
          slug: true,
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
      `<b>Виріб:</b> ${escapeHtml(existing.product.name)} (${escapeHtml(existing.product.slug)})`,
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
      product: {
        select: {
          name: true,
          slug: true,
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
    text: `❌ Запис <code>${escapeHtml(existing.id)}</code> відхилено.`,
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
        product: {
          select: {
            name: true,
            slug: true,
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
        title: `Оплата роботи: ${production.artisan.name}`,
        category: ExpenseCategory.PAYROLL,
        amountUAH: production.totalLaborUAH,
        expenseDate: new Date(),
        notes: [
          'Створено Telegram production bot',
          `productionId=${production.id}`,
          `product=${production.product.slug}`,
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
        product: {
          select: {
            name: true,
            slug: true,
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
      `<b>Виріб:</b> ${escapeHtml(result.production.product.name)} (${escapeHtml(result.production.product.slug)})`,
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

  const [, action, entityId] = callbackData.split(':')

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
    if (!ownerChatId) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Не знайдено chat id',
        showAlert: true,
      })
      return
    }

    if (!entityId) {
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Некоректний callback payload',
        showAlert: true,
      })
      return
    }

    if (action === 'approve') {
      await approveProduction({
        productionId: entityId,
        ownerUserId: fromUserId,
        ownerChatId: toTelegramId(ownerChatId),
        callbackQueryId: callback.id,
      })
      return
    }

    if (action === 'reject') {
      await rejectProduction({
        productionId: entityId,
        ownerChatId: toTelegramId(ownerChatId),
        callbackQueryId: callback.id,
      })
      return
    }

    await payProduction({
      productionId: entityId,
      ownerChatId: toTelegramId(ownerChatId),
      callbackQueryId: callback.id,
    })
    return
  }

  const message = callback.message
  if (!message?.chat?.id) {
    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Сесія не знайдена',
      showAlert: true,
    })
    return
  }

  const chatId = toTelegramId(message.chat.id)
  const userId = fromUserId

  if (action === 'cancel') {
    await clearSession(chatId)
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

    const rateId = entityId || ''
    const rate = await prisma.artisanRate.findFirst({
      where: {
        id: rateId,
        artisanId: artisan.id,
        isActive: true,
      },
      include: {
        product: {
          select: {
            name: true,
            slug: true,
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
      chatId,
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
        `Обрано: <b>${escapeHtml(rate.product.name)}</b> (${escapeHtml(rate.product.slug)})`,
        `Ставка: <b>${formatUAH(rate.ratePerUnitUAH)}</b>`,
        'Тепер надішли кількість (ціле число).',
      ].join('\n'),
    })
    return
  }

  if (action === 'confirm') {
    const artisan = await findLinkedArtisanByTelegram({
      userId,
      chatId,
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

    const session = await getSession(chatId)
    if (!session || session.step !== TelegramBotSessionStep.AWAITING_CONFIRM) {
      await clearSession(chatId)
      await answerCallbackQuery({
        callbackQueryId: callback.id,
        text: 'Сесія застаріла. Запусти /record ще раз.',
        showAlert: true,
      })
      return
    }

    const draft = parseSessionDraft(session.draftPayload)
    if (!draft.rateId || !draft.qty) {
      await clearSession(chatId)
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
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    if (!rate) {
      await clearSession(chatId)
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
        productId: rate.productId,
        rateId: rate.id,
        qty: draft.qty,
        ratePerUnitSnapshotUAH: rate.ratePerUnitUAH,
        totalLaborUAH: draft.qty * rate.ratePerUnitUAH,
        status: ArtisanProductionStatus.SUBMITTED,
        source: 'TELEGRAM_BOT',
        telegramUpdateId: callback.message?.message_id,
      },
    })

    await clearSession(chatId)

    await answerCallbackQuery({
      callbackQueryId: callback.id,
      text: 'Запис збережено',
    })

    await sendTelegramMessage({
      chatId,
      text: [
        '✅ Запис збережено та надіслано на підтвердження.',
        `<b>Виріб:</b> ${escapeHtml(rate.product.name)} (${escapeHtml(rate.product.slug)})`,
        `<b>К-сть:</b> ${production.qty}`,
        `<b>Сума:</b> ${formatUAH(production.totalLaborUAH)}`,
        `<b>ID:</b> <code>${production.id}</code>`,
      ].join('\n'),
    })

    await notifyOwnersAboutSubmission(production.id)
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
  const text = message.text?.trim() || ''

  if (!text) return

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

  if (message.chat.type !== 'private') return

  await handleMasterFreeText({
    chatId,
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
