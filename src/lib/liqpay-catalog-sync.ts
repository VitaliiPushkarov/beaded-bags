import { Prisma } from '@prisma/client'
import XLSX from 'xlsx'

import { prisma } from '@/lib/prisma'
import {
  buildLiqPayCatalogRows,
  normalizeLiqPayCatalogCode,
  sanitizeLiqPayCatalogValue,
  serializeLiqPayCatalogRows,
} from '@/lib/liqpay-catalog'

// Single source of truth for the LiqPay catalog sync, shared by the CLI
// scripts (export-liqpay-catalog / import-liqpay-catalog-mapping) and the
// one-click admin panel at /admin/liqpay.

// --- Export: build the ^-delimited catalog file from the current DB ---------

export async function generateLiqPayCatalogFileContent(): Promise<string> {
  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED', inStock: true },
    orderBy: [{ sortCatalog: 'asc' }, { createdAt: 'desc' }],
    select: {
      slug: true,
      name: true,
      type: true,
      basePriceUAH: true,
      variants: {
        orderBy: [{ sortCatalog: 'asc' }, { id: 'asc' }],
        where: { inStock: true },
        select: {
          id: true,
          sku: true,
          color: true,
          modelSize: true,
          pouchColor: true,
          priceUAH: true,
          discountUAH: true,
          straps: {
            orderBy: { sort: 'asc' },
            select: { id: true, name: true, extraPriceUAH: true },
          },
          pouches: {
            orderBy: { sort: 'asc' },
            select: { id: true, color: true, extraPriceUAH: true },
          },
          sizes: {
            orderBy: { sort: 'asc' },
            select: { id: true, size: true, extraPriceUAH: true },
          },
        },
      },
    },
  })

  return serializeLiqPayCatalogRows(buildLiqPayCatalogRows(products))
}

// --- Import: parse a LiqPay-exported workbook and upsert the goodId mapping --

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

export type LiqPayMappingImportResult = {
  imported: number
  skipped: number
  sheet: string | null
}

export async function importLiqPayMappingFromWorkbook(
  data: ArrayBuffer | Uint8Array | Buffer,
): Promise<LiqPayMappingImportResult> {
  const bytes =
    data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer)
  const workbook = XLSX.read(bytes, { type: 'array', raw: false })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    return { imported: 0, skipped: 0, sheet: null }
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
      where: { externalCode },
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

  return { imported, skipped, sheet: firstSheetName }
}
