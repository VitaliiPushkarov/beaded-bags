import { Prisma } from '@prisma/client'

const RETRYABLE_PRISMA_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017'])
const RETRYABLE_MESSAGE_PATTERNS = [
  /can't reach database server/i,
  /connection.*(closed|terminated|reset)/i,
  /timed out/i,
  /econnreset/i,
  /eai_again/i,
  /enotfound/i,
]

function readMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function isPrismaAvailabilityError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (RETRYABLE_PRISMA_CODES.has(error.code)) return true
  }

  const message = readMessage(error)
  return RETRYABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type PrismaRetryOptions = {
  attempts?: number
  baseDelayMs?: number
  scope?: string
}

export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  options: PrismaRetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3)
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 800)

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const canRetry =
        isPrismaAvailabilityError(error) && attempt < attempts && baseDelayMs > 0
      if (!canRetry) throw error

      const retriesTotal = attempts - 1
      const scopeSuffix = options.scope ? ` (${options.scope})` : ''
      const message = readMessage(error)
      console.warn(
        `[db] transient Prisma availability error${scopeSuffix}. Retry ${attempt}/${retriesTotal}. ${message}`,
      )

      await sleep(baseDelayMs * attempt)
    }
  }

  throw new Error('Unexpected retry state in withPrismaRetry')
}
