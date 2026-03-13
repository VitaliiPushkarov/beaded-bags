import path from 'node:path'

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

import { DEFAULT_SOURCE, getArgValue, hasFlag, loadProjectEnv } from './helpers'

const DEFAULT_MATERIALS_SOURCE = path.join(
  process.cwd(),
  'beaded-bags/db/Матеріали і витрати.xlsx',
)

type MaterialRow = {
  row: number
  name: string
  unit: string
  stockQty: number
  unitCostUAH: number
  notes: string | null
}

type AggregatedMaterial = {
  name: string
  unit: string
  stockQty: number
  weightedCostTotal: number
  fallbackCostTotal: number
  fallbackCostCount: number
  notes: Set<string>
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 1000) / 1000
}

function cleanString(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value

  const normalized = String(value).replace(/\s/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseMaterialsSheet(sourceFile: string): {
  parsedRows: MaterialRow[]
  skipped: Array<{ row: number; reason: string }>
} {
  const workbook = XLSX.readFile(sourceFile, {
    cellDates: false,
    dense: false,
    raw: true,
  })

  const sheet = workbook.Sheets['Матеріали']
  if (!sheet) {
    throw new Error('Sheet "Матеріали" not found')
  }

  const rows = XLSX.utils.sheet_to_json<Array<unknown>>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  })

  if (rows.length === 0) {
    return { parsedRows: [], skipped: [] }
  }

  const parsedRows: MaterialRow[] = []
  const skipped: Array<{ row: number; reason: string }> = []

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? []
    const sourceRow = index + 1

    const name = cleanString(row[0])
    if (!name) continue

    const unit = cleanString(row[1]) || 'шт'
    const stockQtyRaw = parseNumber(row[2]) ?? 0
    const unitCostRaw = parseNumber(row[3])
    const totalUAHRaw = parseNumber(row[6])

    const stockQty = Math.max(0, stockQtyRaw)
    const unitCostByTotal =
      stockQty > 0 && totalUAHRaw != null ? totalUAHRaw / stockQty : null
    // Prefer effective price from total/qty when provided in source.
    // In this workbook, raw unit price can represent pack-level price.
    const unitCost = Math.max(
      0,
      unitCostByTotal ?? unitCostRaw ?? 0,
    )

    if (unitCost <= 0) {
      skipped.push({
        row: sourceRow,
        reason: `Skipped "${name}" because unit cost is empty/zero`,
      })
      continue
    }

    if (stockQty === 0 && unitCost === 0) {
      skipped.push({
        row: sourceRow,
        reason: `Skipped "${name}" because both stock and unit cost are empty`,
      })
      continue
    }

    const category = cleanString(row[4])
    const colorOrForm = cleanString(row[7])
    const noteRaw = cleanString(row[8])
    const amountUSD = parseNumber(row[5])

    const notes = [
      category ? `Категорія: ${category}` : null,
      colorOrForm ? `Колір/Форма: ${colorOrForm}` : null,
      amountUSD != null ? `Ціна у валюті: ${amountUSD}` : null,
      noteRaw || null,
      `excelRow=${sourceRow}`,
    ]
      .filter(Boolean)
      .join(' | ')

    parsedRows.push({
      row: sourceRow,
      name,
      unit,
      stockQty,
      unitCostUAH: roundMoney(unitCost),
      notes: notes || null,
    })
  }

  return { parsedRows, skipped }
}

function aggregateRows(rows: MaterialRow[]) {
  const byName = new Map<string, AggregatedMaterial>()

  for (const row of rows) {
    const key = normalizeKey(row.name)
    const existing = byName.get(key)
    if (!existing) {
      byName.set(key, {
        name: row.name,
        unit: row.unit,
        stockQty: row.stockQty,
        weightedCostTotal: row.unitCostUAH * row.stockQty,
        fallbackCostTotal: row.unitCostUAH,
        fallbackCostCount: 1,
        notes: new Set(row.notes ? [row.notes] : []),
      })
      continue
    }

    // Do not mix different units under one material name.
    // We keep the first unit seen and ignore other unit buckets.
    if (normalizeKey(existing.unit) !== normalizeKey(row.unit)) {
      continue
    }

    existing.stockQty += row.stockQty
    existing.weightedCostTotal += row.unitCostUAH * row.stockQty
    existing.fallbackCostTotal += row.unitCostUAH
    existing.fallbackCostCount += 1
    if (row.notes) existing.notes.add(row.notes)
  }

  return Array.from(byName.values()).map((item) => {
    const unitCostUAH =
      item.stockQty > 0
        ? roundMoney(item.weightedCostTotal / item.stockQty)
        : roundMoney(item.fallbackCostTotal / item.fallbackCostCount)

    return {
      name: item.name,
      unit: item.unit || 'шт',
      stockQty: item.stockQty,
      unitCostUAH,
      notes: item.notes.size > 0 ? Array.from(item.notes).join('\n') : null,
    }
  })
}

async function main() {
  loadProjectEnv()

  const source = path.resolve(
    getArgValue('--source', DEFAULT_MATERIALS_SOURCE) ?? DEFAULT_MATERIALS_SOURCE,
  )
  const apply = hasFlag('--apply')

  const { parsedRows, skipped } = parseMaterialsSheet(source)
  const aggregated = aggregateRows(parsedRows)

  const prisma = new PrismaClient()
  try {
    const existing = await prisma.material.findMany({
      select: { id: true, name: true },
    })

    const existingByName = new Map(existing.map((item) => [item.name.toLowerCase(), item]))

    let creates = 0
    let updates = 0
    for (const row of aggregated) {
      if (existingByName.has(row.name.toLowerCase())) updates += 1
      else creates += 1
    }

    if (!apply) {
      console.log('\n=== Materials import (dry-run) ===')
      console.log(JSON.stringify({
        source,
        parsedRows: parsedRows.length,
        uniqueMaterials: aggregated.length,
        creates,
        updates,
        skipped: skipped.length,
      }, null, 2))

      if (skipped.length) {
        console.log('\n=== Skipped rows (first 20) ===')
        console.log(
          JSON.stringify(
            skipped.slice(0, 20),
            null,
            2,
          ),
        )
      }
      return
    }

    await prisma.$transaction(
      aggregated.map((row) =>
        prisma.material.upsert({
          where: { name: row.name },
          create: {
            name: row.name,
            unit: row.unit,
            stockQty: row.stockQty,
            unitCostUAH: row.unitCostUAH,
            notes: row.notes,
          },
          update: {
            unit: row.unit,
            stockQty: row.stockQty,
            unitCostUAH: row.unitCostUAH,
            notes: row.notes,
          },
        }),
      ),
    )

    console.log('\n=== Materials import (applied) ===')
    console.log(JSON.stringify({
      source,
      parsedRows: parsedRows.length,
      uniqueMaterials: aggregated.length,
      creates,
      updates,
      skipped: skipped.length,
    }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

void main()
