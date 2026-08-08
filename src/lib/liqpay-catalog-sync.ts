import { Prisma } from '@prisma/client'
import * as XLSX from 'xlsx'

import { prisma } from '@/lib/prisma'
import {
  buildLiqPayBaseName,
  buildLiqPayCatalogExternalCode,
  buildLiqPayCatalogRows,
  buildLiqPayOptionName,
  type LiqPayCatalogEntityType,
  looksLikeLiqPayCatalogExternalCode,
  normalizeLiqPayCatalogCode,
  normalizeLiqPayItemName,
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
          discountPercent: true,
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

// The ПРРО cabinet exports plain UTF-8 CSV. Handed those bytes as an array,
// XLSX assumes a single-byte codepage and "Сумка" arrives as "Ð¡ÑÐ¼ÐºÐ°" — the
// names still parse, so nothing errors, but every name match silently fails and
// the import falls back to guessing from SKUs. Decode text ourselves and only
// let XLSX handle the genuinely binary formats.
export function readLiqPayWorkbook(bytes: Uint8Array) {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b // xlsx
  const isOle = bytes[0] === 0xd0 && bytes[1] === 0xcf // legacy xls

  if (isZip || isOle) {
    return XLSX.read(bytes, { type: 'array', raw: false })
  }

  const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '')
  return XLSX.read(text, { type: 'string', raw: false })
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

// --- Resolving a LiqPay catalogue row back to one of our sellable entities ---
//
// A catalogue uploaded from our own export comes back with `vndcode` holding the
// external code we put there, and matching is trivial. The live ПРРО catalogue
// was not built that way: its goods were created before that export existed, so
// `vndcode` holds the shop SKU and the names were typed by hand. Matching
// therefore has to fall back from the exact key to the name, and only then to
// the SKU — and give up loudly rather than guess, because a mapping that points
// at the wrong good puts the wrong product on a tax document.

type CatalogEntry = { externalCode: string; priceUAH: number }

type CatalogEntity = {
  type: LiqPayCatalogEntityType
  id: string
  liqpayGoodId: number | null
  label: string
}

type CatalogIndex = {
  byName: Map<string, CatalogEntry>
  bySku: Map<string, CatalogEntry[]>
  // Keyed by external code, so a resolved mapping can be compared against the
  // fiscal ID someone typed into the product form by hand.
  entities: Map<string, CatalogEntity>
}

async function buildCatalogIndex(): Promise<CatalogIndex> {
  const products = await prisma.product.findMany({
    where: { status: { not: 'ARCHIVED' } },
    select: {
      name: true,
      basePriceUAH: true,
      variants: {
        select: {
          id: true,
          sku: true,
          color: true,
          modelSize: true,
          pouchColor: true,
          priceUAH: true,
          liqpayGoodId: true,
          straps: {
            select: {
              id: true,
              name: true,
              extraPriceUAH: true,
              liqpayGoodId: true,
            },
          },
          pouches: {
            select: {
              id: true,
              color: true,
              extraPriceUAH: true,
              liqpayGoodId: true,
            },
          },
          sizes: {
            select: {
              id: true,
              size: true,
              extraPriceUAH: true,
              liqpayGoodId: true,
            },
          },
        },
      },
    },
  })

  const byName = new Map<string, CatalogEntry>()
  const bySku = new Map<string, CatalogEntry[]>()
  const entities = new Map<string, CatalogEntity>()

  const addName = (name: string, entry: CatalogEntry) => {
    const key = normalizeLiqPayItemName(name)
    // First writer wins: a later duplicate name is ambiguous, and silently
    // rebinding it would move a mapping onto the wrong entity.
    if (key && !byName.has(key)) byName.set(key, entry)
  }

  for (const product of products) {
    for (const variant of product.variants) {
      const baseName = buildLiqPayBaseName({
        productName: product.name,
        color: variant.color,
        modelSize: variant.modelSize,
        pouchColor: variant.pouchColor,
      })
      const variantEntry: CatalogEntry = {
        externalCode: buildLiqPayCatalogExternalCode('VARIANT', variant.id),
        priceUAH: variant.priceUAH ?? product.basePriceUAH ?? 0,
      }
      addName(baseName, variantEntry)
      entities.set(variantEntry.externalCode, {
        type: 'VARIANT',
        id: variant.id,
        liqpayGoodId: variant.liqpayGoodId,
        label: baseName,
      })

      const sku = sanitizeLiqPayCatalogValue(variant.sku)
      if (sku) bySku.set(sku, [...(bySku.get(sku) ?? []), variantEntry])

      for (const strap of variant.straps) {
        if (strap.extraPriceUAH <= 0) continue
        const label = buildLiqPayOptionName({
          baseName,
          optionType: 'Ремінець',
          optionValue: strap.name,
        })
        const code = buildLiqPayCatalogExternalCode('STRAP', strap.id)
        addName(label, { externalCode: code, priceUAH: strap.extraPriceUAH })
        entities.set(code, {
          type: 'STRAP',
          id: strap.id,
          liqpayGoodId: strap.liqpayGoodId,
          label,
        })
      }

      for (const pouch of variant.pouches) {
        if (pouch.extraPriceUAH <= 0) continue
        const label = buildLiqPayOptionName({
          baseName,
          optionType: 'Мішечок',
          optionValue: pouch.color,
        })
        const code = buildLiqPayCatalogExternalCode('POUCH', pouch.id)
        addName(label, { externalCode: code, priceUAH: pouch.extraPriceUAH })
        entities.set(code, {
          type: 'POUCH',
          id: pouch.id,
          liqpayGoodId: pouch.liqpayGoodId,
          label,
        })
      }

      for (const size of variant.sizes) {
        if (size.extraPriceUAH <= 0) continue
        const label = buildLiqPayOptionName({
          baseName,
          optionType: 'Розмір',
          optionValue: size.size,
        })
        const code = buildLiqPayCatalogExternalCode('SIZE', size.id)
        addName(label, { externalCode: code, priceUAH: size.extraPriceUAH })
        entities.set(code, {
          type: 'SIZE',
          id: size.id,
          liqpayGoodId: size.liqpayGoodId,
          label,
        })
      }
    }
  }

  return { byName, bySku, entities }
}

// The confident half: the code we wrote ourselves, or an exact name. Both are
// unambiguous, so they are resolved before anything is guessed from a SKU.
function resolveExactly(
  index: CatalogIndex,
  row: { vndcode: string; itemName: string },
): { externalCode: string; matchedBy: 'code' | 'name' } | null {
  if (looksLikeLiqPayCatalogExternalCode(row.vndcode)) {
    return {
      externalCode: normalizeLiqPayCatalogCode(row.vndcode),
      matchedBy: 'code',
    }
  }

  const byName = index.byName.get(normalizeLiqPayItemName(row.itemName))
  if (byName) return { externalCode: byName.externalCode, matchedBy: 'name' }

  return null
}

export type LiqPayCorrectedGoodId = {
  label: string
  previousGoodId: number
  liqpayGoodId: number
  itemName: string
}

// A fiscal ID typed into the product form wins over the catalogue mapping when a
// receipt is built, so a wrong one keeps printing the wrong product no matter
// how often the catalogue is re-synced. Two of them are wrong today: "Жовтий"
// carries the ID of "Світло-блакитний", "Чорничний" carries "Персиковий".
//
// Only an exact name match is trusted to overwrite one. A SKU match is a guess
// corroborated by uniqueness alone, and a guess must not silently rewrite a
// value a human entered deliberately.
async function correctContradictedGoodIds(
  index: CatalogIndex,
  resolved: LiqPayMappingPlanEntry[],
): Promise<LiqPayCorrectedGoodId[]> {
  const corrected: LiqPayCorrectedGoodId[] = []

  for (const entry of resolved) {
    if (entry.matchedBy !== 'name') continue

    const entity = index.entities.get(entry.externalCode)
    if (!entity?.liqpayGoodId) continue
    if (entity.liqpayGoodId === entry.liqpayGoodId) continue

    const data = { liqpayGoodId: entry.liqpayGoodId }

    if (entity.type === 'VARIANT') {
      await prisma.productVariant.update({ where: { id: entity.id }, data })
    } else if (entity.type === 'STRAP') {
      await prisma.productVariantStrap.update({ where: { id: entity.id }, data })
    } else if (entity.type === 'POUCH') {
      await prisma.productVariantPouch.update({ where: { id: entity.id }, data })
    } else {
      await prisma.productVariantSize.update({ where: { id: entity.id }, data })
    }

    corrected.push({
      label: entity.label,
      previousGoodId: entity.liqpayGoodId,
      liqpayGoodId: entry.liqpayGoodId,
      itemName: entry.itemName,
    })
  }

  return corrected
}

export type LiqPayUnmatchedGood = {
  liqpayGoodId: number
  itemName: string
  priceUAH: number | null
  vndcode: string
}

export type LiqPayMappingImportResult = {
  imported: number
  skipped: number
  sheet: string | null
  matchedByCode: number
  matchedByName: number
  matchedBySku: number
  unmatched: LiqPayUnmatchedGood[]
  corrected: LiqPayCorrectedGoodId[]
}

export async function importLiqPayMappingFromWorkbook(
  data: ArrayBuffer | Uint8Array | Buffer,
): Promise<LiqPayMappingImportResult> {
  return importLiqPayMappingFromWorkbooks([data])
}

// The ПРРО cabinet exports one file per category, and a sync is all of them
// together. They must be planned as a single batch: two categories can both
// reach the same entity of ours — "Різнокольоровий" and "Різнокольорий" share a
// SKU across two files — and importing them one at a time lets the second
// silently overwrite the first instead of being reported as ambiguous.
export async function importLiqPayMappingFromWorkbooks(
  files: Array<ArrayBuffer | Uint8Array | Buffer>,
): Promise<LiqPayMappingImportResult> {
  const rows: Record<string, unknown>[] = []
  let firstSheetName: string | null = null

  for (const data of files) {
    const bytes =
      data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer)
    const workbook = readLiqPayWorkbook(bytes)
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) continue

    firstSheetName ??= sheetName
    const sheet = workbook.Sheets[sheetName]
    rows.push(
      ...XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
      }),
    )
  }

  if (!firstSheetName) {
    return {
      imported: 0,
      skipped: 0,
      sheet: null,
      matchedByCode: 0,
      matchedByName: 0,
      matchedBySku: 0,
      unmatched: [],
      corrected: [],
    }
  }

  const index = await buildCatalogIndex()
  const plan = planLiqPayMappingRows(rows, index)

  for (const entry of plan.resolved) {
    await prisma.liqPayCatalogMapping.upsert({
      where: { externalCode: entry.externalCode },
      update: {
        liqpayGoodId: entry.liqpayGoodId,
        itemName: entry.itemName || null,
        priceUAH: entry.priceUAH,
        rawRow: entry.rawRow as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
      create: {
        externalCode: entry.externalCode,
        liqpayGoodId: entry.liqpayGoodId,
        itemName: entry.itemName || null,
        priceUAH: entry.priceUAH,
        rawRow: entry.rawRow as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
    })
  }

  const corrected = await correctContradictedGoodIds(index, plan.resolved)

  return {
    imported: plan.resolved.length,
    skipped: plan.skipped + plan.unmatched.length,
    sheet: firstSheetName,
    matchedByCode: plan.matchedByCode,
    matchedByName: plan.matchedByName,
    matchedBySku: plan.matchedBySku,
    unmatched: plan.unmatched,
    corrected,
  }
}

export type LiqPayMappingPlanEntry = {
  externalCode: string
  liqpayGoodId: number
  itemName: string
  priceUAH: number | null
  matchedBy: 'code' | 'name' | 'sku'
  rawRow: Record<string, unknown>
}

export type LiqPayMappingPlan = {
  resolved: LiqPayMappingPlanEntry[]
  unmatched: LiqPayUnmatchedGood[]
  skipped: number
  matchedByCode: number
  matchedByName: number
  matchedBySku: number
}

// Decides what the import would write, without writing it. Separated so the
// matching can be exercised against a real catalogue export — the part that can
// silently bind a good to the wrong product is the part worth testing.
export function planLiqPayMappingRows(
  rows: Record<string, unknown>[],
  index: CatalogIndex,
): LiqPayMappingPlan {
  const resolved: LiqPayMappingPlanEntry[] = []
  const unmatched: LiqPayUnmatchedGood[] = []
  const counts = { code: 0, name: 0, sku: 0 }
  let skipped = 0

  type ParsedRow = {
    liqpayGoodId: number
    itemName: string
    priceUAH: number | null
    vndcode: string
    raw: Record<string, unknown>
  }

  const parsed: ParsedRow[] = []

  for (const row of rows) {
    const liqpayGoodId = parseGoodId(pickValue(row, GOOD_ID_ALIASES))
    if (!liqpayGoodId) {
      skipped += 1
      continue
    }

    parsed.push({
      liqpayGoodId,
      itemName: sanitizeLiqPayCatalogValue(
        String(pickValue(row, ITEM_NAME_ALIASES) ?? ''),
      ),
      priceUAH: parsePrice(pickValue(row, PRICE_ALIASES)),
      vndcode: sanitizeLiqPayCatalogValue(
        String(pickValue(row, CODE_ALIASES) ?? ''),
      ),
      raw: row,
    })
  }

  // A SKU is only a hint here: the live catalogue reuses the same vndcode across
  // colour families, so a code appearing on more than one good identifies none
  // of them.
  const vndcodeUses = new Map<string, number>()
  for (const row of parsed) {
    if (!row.vndcode) continue
    vndcodeUses.set(row.vndcode, (vndcodeUses.get(row.vndcode) ?? 0) + 1)
  }

  const claimed = new Set<string>()
  const pendingSku: ParsedRow[] = []

  const claim = (
    row: ParsedRow,
    externalCode: string,
    matchedBy: 'code' | 'name' | 'sku',
  ) => {
    if (claimed.has(externalCode)) {
      // Someone already owns this entity. Whichever good arrives second is not
      // identifiable, so record it rather than overwrite a better match.
      unmatched.push({
        liqpayGoodId: row.liqpayGoodId,
        itemName: row.itemName,
        priceUAH: row.priceUAH,
        vndcode: row.vndcode,
      })
      return
    }

    claimed.add(externalCode)
    counts[matchedBy] += 1
    resolved.push({
      externalCode,
      liqpayGoodId: row.liqpayGoodId,
      itemName: row.itemName,
      priceUAH: row.priceUAH,
      matchedBy,
      rawRow: row.raw,
    })
  }

  for (const row of parsed) {
    const exact = resolveExactly(index, row)
    if (exact) claim(row, exact.externalCode, exact.matchedBy)
    else pendingSku.push(row)
  }

  // Second pass. A SKU is accepted only when it identifies exactly one thing on
  // each side and nothing better already claimed that entity — those two
  // conditions are what stop a reused code binding a good to its neighbour, the
  // way "Світло-блакитний" would otherwise land on "Жовтий".
  //
  // Deliberately not gated on the price agreeing. Prices in the ПРРО catalogue
  // have drifted from the shop, and that drift is the reason this sync is being
  // run — rejecting those rows would refuse to map exactly the goods that most
  // need mapping. Price disagreement is reported instead, not enforced.
  for (const row of pendingSku) {
    const candidates = row.vndcode ? index.bySku.get(row.vndcode) : undefined
    const candidate = candidates?.length === 1 ? candidates[0] : undefined

    if (
      !candidate ||
      vndcodeUses.get(row.vndcode) !== 1 ||
      claimed.has(candidate.externalCode)
    ) {
      unmatched.push({
        liqpayGoodId: row.liqpayGoodId,
        itemName: row.itemName,
        priceUAH: row.priceUAH,
        vndcode: row.vndcode,
      })
      continue
    }

    claim(row, candidate.externalCode, 'sku')
  }

  return {
    resolved,
    unmatched,
    skipped,
    matchedByCode: counts.code,
    matchedByName: counts.name,
    matchedBySku: counts.sku,
  }
}

export { buildCatalogIndex }
export type { CatalogIndex }

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
