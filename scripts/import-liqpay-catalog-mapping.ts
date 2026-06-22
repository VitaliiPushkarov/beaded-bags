import path from 'node:path'

import { Prisma } from '@prisma/client'
import XLSX from 'xlsx'

import { prisma } from '../src/lib/prisma'
import {
  normalizeLiqPayCatalogCode,
  sanitizeLiqPayCatalogValue,
} from '../src/lib/liqpay-catalog'
import { getArgValue, loadProjectEnv } from './imports/helpers'

const CODE_ALIASES = [
  'vndcode',
  'vendorcode',
  'code',
  'externalcode',
  'sku',
  'артикул',
  'кодтовару',
]

const GOOD_ID_ALIASES = [
  'id',
  'goodid',
  'goodsid',
  'idтовару',
  'товарid',
  'idтовара',
]

const ITEM_NAME_ALIASES = ['itemname', 'name', 'назватовару', 'товар']
const PRICE_ALIASES = ['price', 'ціна']

function normalizeHeader(value: string | null | undefined) {
  return sanitizeLiqPayCatalogValue(value)
    .toLowerCase()
    .replace(/[_\-\s]+/g, '')
}

function pickValue(
  row: Record<string, unknown>,
  aliases: string[],
): unknown | undefined {
  const entry = Object.entries(row).find(([key]) =>
    aliases.includes(normalizeHeader(key)),
  )

  return entry?.[1]
}

function parseGoodId(value: unknown) {
  const raw = sanitizeLiqPayCatalogValue(String(value ?? ''))
  const digits = raw.replace(/[^\d]/g, '')
  const goodId = Number(digits)
  return Number.isInteger(goodId) && goodId > 0 ? goodId : null
}

function parsePrice(value: unknown) {
  const raw = sanitizeLiqPayCatalogValue(String(value ?? ''))
  if (!raw) return null

  const normalized = raw.replace(',', '.')
  const price = Number(normalized)
  return Number.isFinite(price) ? Math.round(price) : null
}

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
  const workbook = XLSX.readFile(filePath, { raw: false })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    console.error('[liqpay:mapping] file has no sheets')
    process.exit(1)
  }

  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  })

  let imported = 0
  let skipped = 0

  for (const row of rows) {
    const externalCode = normalizeLiqPayCatalogCode(
      String(pickValue(row, CODE_ALIASES) ?? ''),
    )
    const liqpayGoodId = parseGoodId(pickValue(row, GOOD_ID_ALIASES))

    if (!externalCode || !liqpayGoodId) {
      skipped += 1
      continue
    }

    const itemName = sanitizeLiqPayCatalogValue(
      String(pickValue(row, ITEM_NAME_ALIASES) ?? ''),
    )
    const priceUAH = parsePrice(pickValue(row, PRICE_ALIASES))

    await prisma.liqPayCatalogMapping.upsert({
      where: {
        externalCode,
      },
      update: {
        liqpayGoodId,
        itemName: itemName || null,
        priceUAH,
        rawRow: row as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
      create: {
        externalCode,
        liqpayGoodId,
        itemName: itemName || null,
        priceUAH,
        rawRow: row as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
    })

    imported += 1
  }

  console.info('[liqpay:mapping] OK')
  console.info(
    JSON.stringify(
      {
        filePath,
        sheet: firstSheetName,
        imported,
        skipped,
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
