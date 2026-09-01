import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const PRISMA_RECOVERY_COOLDOWN_MS = 250

let prismaRecoveryPromise: Promise<void> | null = null
let lastPrismaRecoveryAt = 0

function withNeonTimeoutParams(url?: string): string | undefined {
  if (!url) return undefined

  // Neon cold starts can exceed Prisma defaults; tune only when params are absent.
  if (!/\.neon\.tech/i.test(url)) return url

  try {
    const parsed = new URL(url)
    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', '15')
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', '15')
    }
    return parsed.toString()
  } catch {
    return url
  }
}

const datasourceUrl = withNeonTimeoutParams(process.env.DATABASE_URL)

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })
}

export let prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

function setPrismaClient(nextPrisma: PrismaClient): void {
  prisma = nextPrisma
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = nextPrisma
}

export async function resetPrismaConnection(scope?: string): Promise<void> {
  if (prismaRecoveryPromise) {
    await prismaRecoveryPromise
    return
  }

  const now = Date.now()
  if (now - lastPrismaRecoveryAt < PRISMA_RECOVERY_COOLDOWN_MS) return

  lastPrismaRecoveryAt = now
  const scopeSuffix = scope ? ` (${scope})` : ''

  const stalePrisma = prisma
  setPrismaClient(createPrismaClient())

  prismaRecoveryPromise = stalePrisma
    .$disconnect()
    .catch((error) => {
      console.warn(
        `[db] Prisma connection reset failed during retry recovery${scopeSuffix}.`,
        error,
      )
    })
    .finally(() => {
      lastPrismaRecoveryAt = Date.now()
      prismaRecoveryPromise = null
    })

  await prismaRecoveryPromise
}
