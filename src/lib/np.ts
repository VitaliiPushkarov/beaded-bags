export type NPResp<T> = { success: boolean; data?: T; errors?: string[] }

const NP_URL = 'https://api.novaposhta.ua/v2.0/json/'
const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_ATTEMPTS = 3
const BASE_RETRY_DELAY_MS = 200

type NovaPoshtaErrorOptions = {
  status?: number
  errors?: string[]
  transient?: boolean
}

export class NovaPoshtaError extends Error {
  status?: number
  errors: string[]
  transient: boolean

  constructor(message: string, options: NovaPoshtaErrorOptions = {}) {
    super(message)
    this.name = 'NovaPoshtaError'
    this.status = options.status
    this.errors = options.errors ?? []
    this.transient = options.transient ?? false
  }
}

export function isNovaPoshtaTransientError(error: unknown) {
  return error instanceof NovaPoshtaError && error.transient
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

function isTransientMessage(message: string) {
  return /abort|timeout|timed out|fetch failed|econnreset|eai_again|enotfound|socket|network/i.test(
    message,
  )
}

function toNovaPoshtaError(error: unknown): NovaPoshtaError {
  if (error instanceof NovaPoshtaError) return error

  const message = error instanceof Error ? error.message : String(error)
  return new NovaPoshtaError(message || 'Nova Poshta request failed', {
    transient: isTransientMessage(message),
  })
}

export async function npCall<T>(
  modelName: 'AddressGeneral' | 'Address',
  calledMethod: string,
  methodProperties: Record<string, string | number | boolean | null | undefined>
) {
  const apiKey = process.env.NOVA_POSHTA_API_KEY!
  if (!apiKey) throw new Error('Missing NOVA_POSHTA_API_KEY')

  const attempts = readPositiveInt(
    process.env.NOVA_POSHTA_RETRY_ATTEMPTS,
    DEFAULT_ATTEMPTS,
  )
  const timeoutMs = readPositiveInt(
    process.env.NOVA_POSHTA_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  )

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(NP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({
          apiKey,
          modelName,
          calledMethod,
          methodProperties,
        }),
      })

      const text = await res.text()
      let json: NPResp<T>

      try {
        json = JSON.parse(text) as NPResp<T>
      } catch {
        throw new NovaPoshtaError('Nova Poshta returned invalid JSON', {
          status: res.status,
          transient: isTransientStatus(res.status),
        })
      }

      if (!res.ok) {
        throw new NovaPoshtaError(`Nova Poshta HTTP ${res.status}`, {
          status: res.status,
          errors: json.errors,
          transient: isTransientStatus(res.status),
        })
      }

      if (!json.success) {
        const errors = json.errors ?? []
        const message = errors.join(', ') || 'Nova Poshta API error'

        throw new NovaPoshtaError(message, {
          status: res.status,
          errors,
          transient: isTransientMessage(message),
        })
      }

      return json.data as T
    } catch (error) {
      const npError = toNovaPoshtaError(error)

      if (npError.transient && attempt < attempts) {
        await sleep(BASE_RETRY_DELAY_MS * attempt)
        continue
      }

      throw npError
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new NovaPoshtaError('Nova Poshta request failed', { transient: true })
}
