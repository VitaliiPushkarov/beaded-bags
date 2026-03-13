import fs from 'node:fs'
import path from 'node:path'

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

import {
  DEFAULT_MAPPING,
  getArgValue,
  hasFlag,
  loadProjectEnv,
} from './helpers'

const DEFAULT_SOURCE = path.join(
  process.cwd(),
  'beaded-bags/db/Матеріали і витрати.xlsx',
)
const DEFAULT_SHEET = 'Виготовлення товарів матеріали'

const MODEL_TO_PRODUCT_SLUG_ALIASES = new Map<string, string>([
  ['навушники сердце', 'heart-earmuffs'],
  ['навушники серце', 'heart-earmuffs'],
])

type ProductMapEntry = {
  excelProductName?: string | null
  excelModelName?: string | null
  autoMatch?: { matched?: boolean; productSlug?: string | null } | null
  manualOverride?: { productSlug?: string | null } | null
}

type ProductMappingFile = {
  entries?: ProductMapEntry[]
}

type ParsedRow = {
  sourceRow: number
  modelName: string
  variantName: string
  materialName: string
  quantity: number
  unitCostUAH: number
  totalCostUAH: number
  variantKey: string
}

type AggregatedUsage = {
  productId: string
  productName: string
  materialId: string
  materialName: string
  materialUnitCostUAH: number
  quantitiesByVariantName: Map<string, number>
  totalsByVariantName: Map<string, number>
  rows: number[]
}

function normalize(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[«»"'`’]/g, '')
    .replace(/[^a-zа-яіїєґ0-9]+/giu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function splitTokens(value: string): string[] {
  if (!value) return []
  return value
    .split(' ')
    .map((token) =>
      token.replace(/(ий|ій|ого|ому|а|я|е|є|і|и|ою|их|ими)$/u, ''),
    )
    .filter(Boolean)
}

function similarityScore(leftRaw: string, rightRaw: string): number {
  const left = normalize(leftRaw)
  const right = normalize(rightRaw)
  if (!left || !right) return 0
  if (left === right) return 1
  if (left.includes(right) || right.includes(left)) return 0.9

  const leftTokens = splitTokens(left)
  const rightTokens = splitTokens(right)
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0

  const rightSet = new Set(rightTokens)
  const intersection = leftTokens.filter((token) => rightSet.has(token)).length
  return intersection / Math.max(leftTokens.length, rightTokens.length)
}

function parseNumber(value: unknown): number {
  if (value == null || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value

  const raw = String(value).replace(/\s/g, '').replace(',', '.')
  const matched = raw.match(/-?\d+(\.\d+)?/)
  if (!matched) return 0

  const parsed = Number(matched[0])
  return Number.isFinite(parsed) ? parsed : 0
}

function parseQuantity(value: unknown): number {
  if (value == null || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value

  const raw = String(value).toLowerCase()
  const numbers = Array.from(raw.matchAll(/-?\d+(?:[.,]\d+)?/g)).map((match) =>
    Number((match[0] ?? '').replace(',', '.')),
  ).filter((entry) => Number.isFinite(entry))

  if (numbers.length === 0) return 0

  // Example: "1 уп / 2000 шт" should be treated as 2000 pcs.
  if (raw.includes('уп') && numbers.length >= 2) {
    const multiplied = numbers[0] * numbers[1]
    if (Number.isFinite(multiplied) && multiplied > 0) return multiplied
  }

  return numbers[0]
}

function parseSheet(sourceFile: string, sheetName: string): ParsedRow[] {
  const workbook = XLSX.readFile(sourceFile, {
    cellDates: false,
    dense: false,
    raw: true,
  })
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found in ${sourceFile}`)
  }

  const rows = XLSX.utils.sheet_to_json<Array<unknown>>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  })

  const parsedRows: ParsedRow[] = []
  let currentModelName = ''
  let currentVariantName = ''

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] ?? []
    const sourceRow = index + 1

    const modelName = String(row[1] ?? '').trim()
    const variantName = String(row[2] ?? '').trim()
    const materialName = String(row[3] ?? '').trim()
    const quantityRaw = row[4]
    const unitCostRaw = row[5]
    const totalCostRaw = row[6]

    if (modelName) currentModelName = modelName
    if (variantName) currentVariantName = variantName

    if (!currentModelName || !materialName) continue
    if (normalize(materialName) === normalize('Готовий товар')) continue

    const quantity = parseQuantity(quantityRaw)
    if (quantity <= 0) continue

    parsedRows.push({
      sourceRow,
      modelName: currentModelName,
      variantName: currentVariantName,
      materialName,
      quantity,
      unitCostUAH: parseNumber(unitCostRaw),
      totalCostUAH: parseNumber(totalCostRaw),
      variantKey: `${currentModelName} | ${currentVariantName || 'без варіанту'}`,
    })
  }

  return parsedRows
}

async function main() {
  loadProjectEnv()

  const source = path.resolve(getArgValue('--source', DEFAULT_SOURCE) ?? DEFAULT_SOURCE)
  const sheet = getArgValue('--sheet', DEFAULT_SHEET) ?? DEFAULT_SHEET
  const mappingPath = path.resolve(getArgValue('--mapping', DEFAULT_MAPPING) ?? DEFAULT_MAPPING)
  const apply = hasFlag('--apply')

  const parsedRows = parseSheet(source, sheet)
  const mappingJson = JSON.parse(
    fs.readFileSync(mappingPath, 'utf8'),
  ) as ProductMappingFile

  const prisma = new PrismaClient()
  try {
    const [products, variants, materials] = await Promise.all([
      prisma.product.findMany({
        select: { id: true, slug: true, name: true },
      }),
      prisma.productVariant.findMany({
        select: {
          id: true,
          color: true,
          productId: true,
          product: { select: { slug: true } },
        },
      }),
      prisma.material.findMany({
        select: { id: true, name: true, unitCostUAH: true },
      }),
    ])

    const productsBySlug = new Map(products.map((product) => [product.slug, product]))
    const productAliases = new Map<string, string>()

    for (const product of products) {
      productAliases.set(normalize(product.name), product.slug)
      productAliases.set(normalize(product.slug), product.slug)
    }

    for (const entry of mappingJson.entries ?? []) {
      const mappedSlug =
        entry.manualOverride?.productSlug?.trim() ||
        (entry.autoMatch?.matched ? entry.autoMatch.productSlug?.trim() : '')
      if (!mappedSlug) continue

      if (entry.excelModelName?.trim()) {
        productAliases.set(normalize(entry.excelModelName), mappedSlug)
      }
      if (entry.excelProductName?.trim()) {
        productAliases.set(normalize(entry.excelProductName), mappedSlug)
      }
    }

    for (const [excelModelName, productSlug] of MODEL_TO_PRODUCT_SLUG_ALIASES.entries()) {
      if (productsBySlug.has(productSlug)) {
        productAliases.set(normalize(excelModelName), productSlug)
      }
    }

    const materialByNormalized = new Map<
      string,
      { id: string; name: string; unitCostUAH: number }
    >()
    for (const material of materials) {
      materialByNormalized.set(normalize(material.name), material)
    }

    const variantsByProductId = new Map<string, typeof variants>()
    for (const variant of variants) {
      const list = variantsByProductId.get(variant.productId) ?? []
      list.push(variant)
      variantsByProductId.set(variant.productId, list)
    }

    const usagesByKey = new Map<string, AggregatedUsage>()
    const skippedRows: string[] = []
    const unresolvedVariants = new Map<string, number>()
    const unresolvedMaterials = new Map<string, number>()

    function resolveProductFromModel(modelName: string) {
      const normalizedModel = normalize(modelName)
      const aliasSlug = productAliases.get(normalizedModel)
      if (aliasSlug && productsBySlug.has(aliasSlug)) {
        return productsBySlug.get(aliasSlug) ?? null
      }

      let best: { productId: string; score: number } | null = null
      for (const product of products) {
        const score = similarityScore(modelName, product.name)
        if (!best || score > best.score) {
          best = { productId: product.id, score }
        }
      }

      if (best && best.score >= 0.55) {
        return products.find((product) => product.id === best?.productId) ?? null
      }

      return null
    }

    function resolveMaterialByName(name: string) {
      const normalized = normalize(name)
      const exact = materialByNormalized.get(normalized)
      if (exact) return exact

      let best: {
        material: { id: string; name: string; unitCostUAH: number }
        score: number
      } | null = null
      for (const material of materials) {
        const score = similarityScore(name, material.name)
        if (!best || score > best.score) {
          best = { material, score }
        }
      }

      if (best && best.score >= 0.7) {
        return best.material
      }
      return null
    }

    for (const row of parsedRows) {
      const product = resolveProductFromModel(row.modelName)
      if (!product) {
        const key = `${row.modelName} | ${row.variantName || 'без варіанту'}`
        unresolvedVariants.set(key, (unresolvedVariants.get(key) ?? 0) + 1)
        skippedRows.push(
          `row ${row.sourceRow}: product is not mapped for "${key}"`,
        )
        continue
      }

      const material = resolveMaterialByName(row.materialName)
      if (!material) {
        unresolvedMaterials.set(
          row.materialName,
          (unresolvedMaterials.get(row.materialName) ?? 0) + 1,
        )
        skippedRows.push(
          `row ${row.sourceRow}: material "${row.materialName}" is not mapped`,
        )
        continue
      }

      const key = `${product.id}::${material.id}`
      const existing = usagesByKey.get(key)
      if (!existing) {
        usagesByKey.set(key, {
          productId: product.id,
          productName: product.name,
          materialId: material.id,
          materialName: material.name,
          materialUnitCostUAH: material.unitCostUAH,
          quantitiesByVariantName: new Map([
            [row.variantName || '__default', row.quantity],
          ]),
          totalsByVariantName: new Map([
            [row.variantName || '__default', row.totalCostUAH],
          ]),
          rows: [row.sourceRow],
        })
        continue
      }

      const variantName = row.variantName || '__default'
      existing.quantitiesByVariantName.set(
        variantName,
        (existing.quantitiesByVariantName.get(variantName) ?? 0) + row.quantity,
      )
      existing.totalsByVariantName.set(
        variantName,
        (existing.totalsByVariantName.get(variantName) ?? 0) + row.totalCostUAH,
      )
      existing.rows.push(row.sourceRow)
    }

    const upsertRecords = Array.from(usagesByKey.values()).map((usage) => {
      const quantities = Array.from(usage.quantitiesByVariantName.values())
      const avgQty =
        quantities.length > 0
          ? quantities.reduce((sum, qty) => sum + qty, 0) / quantities.length
          : 0

      const variantQtyMap = Object.fromEntries(
        Array.from(usage.quantitiesByVariantName.entries())
          .sort(([left], [right]) => left.localeCompare(right, 'uk'))
          .map(([variantName, qty]) => [variantName, Number(qty.toFixed(6))]),
      )
      const variantCostFactorMap = Object.fromEntries(
        Array.from(usage.quantitiesByVariantName.entries())
          .sort(([left], [right]) => left.localeCompare(right, 'uk'))
          .map(([variantName, qty]) => {
            const total = usage.totalsByVariantName.get(variantName) ?? 0
            const sourceUnitCost = qty > 0 ? total / qty : 0
            const factor =
              usage.materialUnitCostUAH > 0
                ? sourceUnitCost / usage.materialUnitCostUAH
                : 1
            return [variantName, Number(factor.toFixed(6))]
          }),
      )

      return {
        productId: usage.productId,
        productName: usage.productName,
        materialId: usage.materialId,
        materialName: usage.materialName,
        quantity: Number(avgQty.toFixed(3)),
        notes: [
          'excelImport=variant-materials-average',
          `variants=${usage.quantitiesByVariantName.size}`,
          `sourceRows=${usage.rows.join(',')}`,
          `variantQtyMap=${JSON.stringify(variantQtyMap)}`,
          `variantCostFactorMap=${JSON.stringify(variantCostFactorMap)}`,
        ].join('\n'),
      }
    })

    const summary = {
      source,
      sheet,
      parsedRows: parsedRows.length,
      mappedUsagePairs: upsertRecords.length,
      productsAffected: new Set(upsertRecords.map((item) => item.productId)).size,
      skippedRows: skippedRows.length,
      unresolvedVariantCombos: unresolvedVariants.size,
      unresolvedMaterials: unresolvedMaterials.size,
    }

    if (!apply) {
      console.log('\n=== Variant materials import (dry-run) ===')
      console.log(JSON.stringify(summary, null, 2))
      console.log('\n=== Top unresolved variant combos ===')
      console.log(
        JSON.stringify(
          Array.from(unresolvedVariants.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20),
          null,
          2,
        ),
      )
      console.log('\n=== Top unresolved materials ===')
      console.log(
        JSON.stringify(
          Array.from(unresolvedMaterials.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20),
          null,
          2,
        ),
      )
      return
    }

    await prisma.$transaction(
      upsertRecords.map((record) =>
        prisma.productMaterial.upsert({
          where: {
            productId_materialId: {
              productId: record.productId,
              materialId: record.materialId,
            },
          },
          create: {
            productId: record.productId,
            materialId: record.materialId,
            quantity: record.quantity,
            notes: record.notes,
          },
          update: {
            quantity: record.quantity,
            notes: record.notes,
          },
        }),
      ),
    )

    console.log('\n=== Variant materials import (applied) ===')
    console.log(JSON.stringify(summary, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

void main()
