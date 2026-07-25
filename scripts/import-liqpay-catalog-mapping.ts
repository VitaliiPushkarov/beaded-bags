import fs from 'node:fs'
import path from 'node:path'

import { prisma } from '../src/lib/prisma'
import { importLiqPayMappingFromWorkbook } from '../src/lib/liqpay-catalog-sync'
import { getArgValue, loadProjectEnv } from './imports/helpers'

async function main() {
  loadProjectEnv()

  const fileArg = getArgValue('--file')
  if (!fileArg) {
    console.error(
      'Usage: npm run import:liqpay:mapping -- --file=/absolute/or/relative/path/to/catalog.xlsx',
    )
    process.exit(1)
  }

  const filePath = path.resolve(process.cwd(), fileArg)
  const buffer = fs.readFileSync(filePath)
  const result = await importLiqPayMappingFromWorkbook(buffer)

  console.info('[liqpay:mapping] OK')
  console.info(
    JSON.stringify(
      {
        filePath,
        sheet: result.sheet,
        imported: result.imported,
        skipped: result.skipped,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error('[liqpay:mapping] FAILED')
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined)
  })
