import { PrismaClient } from '@prisma/client'

function redactedHost(url: string): string {
  try {
    const normalized = url.replace(/^prisma\+postgres:\/\//, 'postgresql://')
    return new URL(normalized).host
  } catch {
    return 'unknown-host'
  }
}

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('[db:probe] DATABASE_URL is missing')
    process.exit(1)
  }

  const prisma = new PrismaClient({ log: ['error'] })
  const startedAt = Date.now()

  try {
    await prisma.$connect()

    const rows = await prisma.$queryRaw<Array<{ now: Date; current_database: string; current_user: string }>>`
      SELECT NOW() as now, current_database() as current_database, current_user as current_user
    `

    const elapsedMs = Date.now() - startedAt
    const row = rows[0]

    console.info('[db:probe] OK')
    console.info(
      JSON.stringify(
        {
          host: redactedHost(url),
          elapsedMs,
          currentDatabase: row?.current_database ?? null,
          currentUser: row?.current_user ?? null,
          serverTime: row?.now?.toISOString?.() ?? String(row?.now ?? ''),
        },
        null,
        2,
      ),
    )
  } catch (error) {
    const elapsedMs = Date.now() - startedAt
    console.error('[db:probe] FAILED')
    console.error(
      JSON.stringify(
        {
          host: redactedHost(url),
          elapsedMs,
          message: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    )
    process.exit(1)
  } finally {
    await prisma.$disconnect().catch(() => undefined)
  }
}

main().catch((error) => {
  console.error('[db:probe] UNHANDLED')
  console.error(error)
  process.exit(1)
})
