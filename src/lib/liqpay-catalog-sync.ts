import { Prisma } from '@prisma/client'
import * as XLSX from 'xlsx'

import { prisma } from '@/lib/prisma'
import {
  buildLiqPayCatalogExternalCode,
  buildLiqPayCatalogRows,
  type LiqPayCatalogEntityType,
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

// --- Report: sellable items that still lack a LiqPay goodId -----------------

export type UnmappedLiqPayEntity = {
  type: LiqPayCatalogEntityType
  id: string
  label: string
  productName: string
  externalCode: string
}

export type UnmappedLiqPayReport = {
  items: UnmappedLiqPayEntity[]
  checkedCount: number
}

function buildVariantLabel(variant: {
  color: string | null
  modelSize: string | null
  pouchColor: string | null
}): string {
  const parts = [
    variant.color?.trim(),
    variant.modelSize?.trim() ? `Розмір: ${variant.modelSize.trim()}` : null,
    variant.pouchColor?.trim() ? `Мішечок: ${variant.pouchColor.trim()}` : null,
  ].filter((part): part is string => Boolean(part))
  return parts.join(' · ') || 'Базовий варіант'
}

// Lists every published, in-stock item that would appear on a fiscal receipt
// but cannot resolve a LiqPay goodId (no manual liqpayGoodId and no mapping) —
// i.e. exactly the items that would break LiqPay checkout with
// "Missing LiqPay good ID". Options (strap/pouch/size) are only checked when
// they carry an extra price, since a zero-price option is never fiscalized.
export async function findUnmappedLiqPayEntities(): Promise<UnmappedLiqPayReport> {
  const [variants, mappings] = await Promise.all([
    prisma.productVariant.findMany({
      where: { inStock: true, product: { status: 'PUBLISHED' } },
      orderBy: [
        { product: { sortCatalog: 'asc' } },
        { sortCatalog: 'asc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        color: true,
        modelSize: true,
        pouchColor: true,
        liqpayGoodId: true,
        product: { select: { name: true } },
        straps: {
          where: { extraPriceUAH: { gt: 0 } },
          select: { id: true, name: true, liqpayGoodId: true },
        },
        pouches: {
          where: { extraPriceUAH: { gt: 0 } },
          select: { id: true, color: true, liqpayGoodId: true },
        },
        sizes: {
          where: { extraPriceUAH: { gt: 0 } },
          select: { id: true, size: true, liqpayGoodId: true },
        },
      },
    }),
    prisma.liqPayCatalogMapping.findMany({ select: { externalCode: true } }),
  ])

  const mappedCodes = new Set(mappings.map((mapping) => mapping.externalCode))

  const isMapped = (
    type: LiqPayCatalogEntityType,
    id: string,
    manualGoodId: number | null,
  ) => {
    if (manualGoodId && Number.isFinite(manualGoodId)) return true
    return mappedCodes.has(buildLiqPayCatalogExternalCode(type, id))
  }

  const items: UnmappedLiqPayEntity[] = []
  let checkedCount = 0

  for (const variant of variants) {
    const productName = variant.product.name
    checkedCount += 1
    if (!isMapped('VARIANT', variant.id, variant.liqpayGoodId)) {
      items.push({
        type: 'VARIANT',
        id: variant.id,
        label: buildVariantLabel(variant),
        productName,
        externalCode: buildLiqPayCatalogExternalCode('VARIANT', variant.id),
      })
    }

    for (const strap of variant.straps) {
      checkedCount += 1
      if (!isMapped('STRAP', strap.id, strap.liqpayGoodId)) {
        items.push({
          type: 'STRAP',
          id: strap.id,
          label: `Ремінець: ${strap.name}`,
          productName,
          externalCode: buildLiqPayCatalogExternalCode('STRAP', strap.id),
        })
      }
    }

    for (const pouch of variant.pouches) {
      checkedCount += 1
      if (!isMapped('POUCH', pouch.id, pouch.liqpayGoodId)) {
        items.push({
          type: 'POUCH',
          id: pouch.id,
          label: `Мішечок: ${pouch.color}`,
          productName,
          externalCode: buildLiqPayCatalogExternalCode('POUCH', pouch.id),
        })
      }
    }

    for (const size of variant.sizes) {
      checkedCount += 1
      if (!isMapped('SIZE', size.id, size.liqpayGoodId)) {
        items.push({
          type: 'SIZE',
          id: size.id,
          label: `Розмір: ${size.size}`,
          productName,
          externalCode: buildLiqPayCatalogExternalCode('SIZE', size.id),
        })
      }
    }
  }

  return { items, checkedCount }
}
