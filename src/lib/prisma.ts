import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
