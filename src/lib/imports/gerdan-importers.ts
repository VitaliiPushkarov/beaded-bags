import type { ExpenseCategory, PrismaClient, PurchaseStatus } from '@prisma/client'

import {
  buildAdsImportMarker,
  buildCostImportMarker,
  buildPurchaseImportMarker,
  parseMonthFromAdTitle,
  parseMonthLabel,
} from './gerdan-normalize'
import { resolveMappedProductSlug } from './gerdan-map-products'
import type {
  GerdanWorkbookStage,
  ImportOptions,
  ImportReport,
  ProductLookupRow,
  ProductMappingFile,
} from './gerdan-types'

const EXCEL_IMPORT_SUPPLIER = 'Excel legacy import'

type CostRecord = {
  productId: string
  sourceRow: number
  materialsCostUAH: number
  laborCostUAH: number
  packagingCostUAH: number
  shippingCostUAH: number
  otherCostUAH: number
  notes: string
}

type AdsRecord = {
  sourceRow: number
  title: string
  amountUAH: number
  expenseDate: Date
  notes: string
}

type PurchaseRecord = {
  blockId: string
  purchasedAt: Date
  subtotalUAH: number
  deliveryUAH: number
  totalUAH: number
  notes: string
  items: Array<{
    title: string
    qty: number
    unit: string
    unitPriceUAH: number
    totalUAH: number
  }>
}

function buildMonthNameLookup(stage: GerdanWorkbookStage): Map<string, number> {
  const map = new Map<string, number>()

  for (const block of stage.sheets.purchases.monthBlocks) {
    const parsed = parseMonthLabel(block.monthLabel)
    if (!parsed) continue

    const monthName = block.monthLabel.split(/\s+/).slice(1).join(' ').trim().toLowerCase()
    if (monthName && !map.has(monthName)) {
      map.set(monthName, parsed.year)
    }
  }

  return map
}

function buildCostRecords(
  stage: GerdanWorkbookStage,
  mapping: ProductMappingFile,
  productsBySlug: Map<string, ProductLookupRow>,
  skippedReasons: string[],
): CostRecord[] {
  const mappingByRow = new Map(mapping.entries.map((entry) => [entry.sourceRow, entry]))
  const records: CostRecord[] = []

  for (const row of stage.sheets.productCosts.rows) {
    const entry = mappingByRow.get(row.sourceRow)
    if (!entry) {
      skippedReasons.push(`costs: row ${row.sourceRow} missing mapping entry`)
      continue
    }

    const productSlug = resolveMappedProductSlug(entry)
    if (!productSlug) {
      skippedReasons.push(`costs: row ${row.sourceRow} skipped because product is not mapped`)
      continue
    }

    const product = productsBySlug.get(productSlug)
    if (!product) {
      skippedReasons.push(`costs: row ${row.sourceRow} mapped slug "${productSlug}" not found in DB`)
      continue
    }

    const marker = buildCostImportMarker(row.sourceRow)
    const notes = [
      marker,
      `excelProductName=${row.excelProductName}`,
      row.excelVariantName ? `variant=${row.excelVariantName}` : null,
      row.excelSize ? `size=${row.excelSize}` : null,
      row.sitePriceUAH != null ? `sitePriceUAH=${row.sitePriceUAH}` : null,
      row.totalCostUAH != null ? `totalCostUAH=${row.totalCostUAH}` : null,
      'bankCommissionImported=false',
    ]
      .filter(Boolean)
      .join('\n')

    records.push({
      productId: product.id,
      sourceRow: row.sourceRow,
      materialsCostUAH: Math.round(row.materialsCostUAH || 0),
      laborCostUAH: Math.round(row.laborCostUAH || 0),
      packagingCostUAH: Math.round(row.packagingCostUAH || 0),
      shippingCostUAH: 0,
      otherCostUAH: Math.round((row.taxCostUAH || 0) + (row.adCostUAH || 0)),
      notes,
    })
  }

  return records
}

function buildAdsRecords(
  stage: GerdanWorkbookStage,
  skippedReasons: string[],
): AdsRecord[] {
  const knownMonthYears = buildMonthNameLookup(stage)
  const records: AdsRecord[] = []

  for (const row of stage.sheets.ads.rows) {
    if (!row.importable || row.amountUAH == null) {
      skippedReasons.push(
        `ads: row ${row.sourceRow} skipped because amount in UAH is missing`,
      )
      continue
    }

    const expenseDate = parseMonthFromAdTitle(row.title, knownMonthYears)
    if (!expenseDate) {
      skippedReasons.push(
        `ads: row ${row.sourceRow} skipped because month/year could not be resolved`,
      )
      continue
    }

    records.push({
      sourceRow: row.sourceRow,
      title: row.title,
      amountUAH: Math.round(row.amountUAH),
      expenseDate,
      notes: [
        buildAdsImportMarker(row.sourceRow),
        row.account ? `account=${row.account}` : null,
        row.paymentSource ? `paymentSource=${row.paymentSource}` : null,
        row.amountUSD != null ? `amountUSD=${row.amountUSD}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    })
  }

  return records
}

function buildPurchaseRecords(
  stage: GerdanWorkbookStage,
  skippedReasons: string[],
): PurchaseRecord[] {
  const records: PurchaseRecord[] = []

  for (const block of stage.sheets.purchases.monthBlocks) {
    const parsedMonth = parseMonthLabel(block.monthLabel)
    if (!parsedMonth) {
      skippedReasons.push(
        `purchases: block ${block.blockId} skipped because month label "${block.monthLabel}" is invalid`,
      )
      continue
    }

    const items = block.items
      .map((item) => {
        const qty = item.quantity ?? item.packageCount ?? 0
        const unitPriceUAH =
          item.unitPriceUAH ??
          (item.totalUAH != null && qty > 0 ? item.totalUAH / qty : 0)
        const totalUAH =
          item.totalUAH ?? (qty > 0 && unitPriceUAH > 0 ? qty * unitPriceUAH : 0)

        if (!item.name || totalUAH <= 0) {
          skippedReasons.push(
            `purchases: row ${item.sourceRow} skipped because name or total amount is missing`,
          )
          return null
        }

        const title = [item.category, item.name, item.extraInfo, item.colorOrForm]
          .filter(Boolean)
          .join(' | ')

        return {
          title,
          qty,
          unit: item.unit || 'pcs',
          unitPriceUAH: Math.round(unitPriceUAH),
          totalUAH: Math.round(totalUAH),
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))

    if (items.length === 0) {
      skippedReasons.push(
        `purchases: block ${block.blockId} skipped because it has no importable items`,
      )
      continue
    }

    const subtotalUAH = items.reduce((sum, item) => sum + item.totalUAH, 0)
    const purchasedAt = new Date(Date.UTC(parsedMonth.year, parsedMonth.month - 1, 1))
    const marker = buildPurchaseImportMarker(block.blockId)

    records.push({
      blockId: block.blockId,
      purchasedAt,
      subtotalUAH,
      deliveryUAH: 0,
      totalUAH: subtotalUAH,
      notes: [
        marker,
        `monthLabel=${block.monthLabel}`,
        block.exchangeRate != null ? `exchangeRate=${block.exchangeRate}` : null,
        `sourceHeaderRow=${block.sourceHeaderRow}`,
      ]
        .filter(Boolean)
        .join('\n'),
      items,
    })
  }

  return records
}

async function applyCosts(
  prisma: PrismaClient,
  records: CostRecord[],
) {
  await prisma.$transaction(async (tx) => {
    for (const record of records) {
      await tx.productCostProfile.upsert({
        where: { productId: record.productId },
        create: {
          productId: record.productId,
          materialsCostUAH: record.materialsCostUAH,
          laborCostUAH: record.laborCostUAH,
          packagingCostUAH: record.packagingCostUAH,
          shippingCostUAH: record.shippingCostUAH,
          otherCostUAH: record.otherCostUAH,
          notes: record.notes,
        },
        update: {
          materialsCostUAH: record.materialsCostUAH,
          laborCostUAH: record.laborCostUAH,
          packagingCostUAH: record.packagingCostUAH,
          shippingCostUAH: record.shippingCostUAH,
          otherCostUAH: record.otherCostUAH,
          notes: record.notes,
        },
      })
    }
  })
}

async function applyAds(
  prisma: PrismaClient,
  records: AdsRecord[],
): Promise<{ creates: number }> {
  let creates = 0

  await prisma.$transaction(async (tx) => {
    for (const record of records) {
      const marker = buildAdsImportMarker(record.sourceRow)
      const existing = await tx.expense.findFirst({
        where: {
          category: 'ADS' as ExpenseCategory,
          title: record.title,
          amountUAH: record.amountUAH,
          expenseDate: record.expenseDate,
          notes: {
            contains: marker,
          },
        },
        select: { id: true },
      })

      if (existing) continue
      creates += 1

      await tx.expense.create({
        data: {
          category: 'ADS' as ExpenseCategory,
          title: record.title,
          amountUAH: record.amountUAH,
          expenseDate: record.expenseDate,
          notes: record.notes,
        },
      })
    }
  })

  return { creates }
}

async function applyPurchases(
  prisma: PrismaClient,
  records: PurchaseRecord[],
): Promise<{ creates: number; updates: number }> {
  let creates = 0
  let updates = 0

  await prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.upsert({
      where: { name: EXCEL_IMPORT_SUPPLIER },
      create: { name: EXCEL_IMPORT_SUPPLIER, notes: 'Created by Excel import' },
      update: {},
      select: { id: true },
    })

    for (const record of records) {
      const marker = buildPurchaseImportMarker(record.blockId)
      const existing = await tx.purchase.findFirst({
        where: {
          supplierId: supplier.id,
          notes: {
            contains: marker,
          },
        },
        select: { id: true },
      })

      if (existing) {
        updates += 1
        await tx.purchaseItem.deleteMany({
          where: { purchaseId: existing.id },
        })
        await tx.purchase.update({
          where: { id: existing.id },
          data: {
            status: 'RECEIVED' as PurchaseStatus,
            purchasedAt: record.purchasedAt,
            invoiceNumber: null,
            subtotalUAH: record.subtotalUAH,
            deliveryUAH: record.deliveryUAH,
            totalUAH: record.totalUAH,
            notes: record.notes,
            items: {
              createMany: {
                data: record.items,
              },
            },
          },
        })
      } else {
        creates += 1
        await tx.purchase.create({
          data: {
            supplierId: supplier.id,
            status: 'RECEIVED' as PurchaseStatus,
            purchasedAt: record.purchasedAt,
            invoiceNumber: null,
            subtotalUAH: record.subtotalUAH,
            deliveryUAH: record.deliveryUAH,
            totalUAH: record.totalUAH,
            notes: record.notes,
            items: {
              createMany: {
                data: record.items,
              },
            },
          },
        })
      }
    }
  })

  return { creates, updates }
}

export async function runGerdanImport(params: {
  prisma: PrismaClient
  stage: GerdanWorkbookStage
  mapping: ProductMappingFile
  options: ImportOptions
}) {
  const { prisma, stage, mapping, options } = params
  const skippedReasons: string[] = []

  const products = await prisma.product.findMany({
    select: { id: true, slug: true, name: true, type: true, group: true },
  })
  const productsBySlug = new Map(products.map((product) => [product.slug, product]))

  const costRecords = options.sections.has('costs')
    ? buildCostRecords(stage, mapping, productsBySlug, skippedReasons)
    : []
  const adsRecords = options.sections.has('ads')
    ? buildAdsRecords(stage, skippedReasons)
    : []
  const purchaseRecords = options.sections.has('purchases')
    ? buildPurchaseRecords(stage, skippedReasons)
    : []

  let purchaseApplyStats = { creates: 0, updates: 0 }
  let adsApplyStats = { creates: 0 }
  let purchaseDryRunStats = { creates: 0, updates: 0 }
  let adsDryRunCreates = adsRecords.length

  if (options.dryRun && options.sections.has('ads')) {
    let creates = 0
    for (const record of adsRecords) {
      const existing = await prisma.expense.findFirst({
        where: {
          category: 'ADS',
          title: record.title,
          amountUAH: record.amountUAH,
          expenseDate: record.expenseDate,
          notes: {
            contains: buildAdsImportMarker(record.sourceRow),
          },
        },
        select: { id: true },
      })

      if (!existing) creates += 1
    }
    adsDryRunCreates = creates
  }

  if (options.dryRun && options.sections.has('purchases')) {
    const supplier = await prisma.supplier.findUnique({
      where: { name: EXCEL_IMPORT_SUPPLIER },
      select: { id: true },
    })

    let creates = 0
    let updates = 0

    for (const record of purchaseRecords) {
      const existing = supplier
        ? await prisma.purchase.findFirst({
            where: {
              supplierId: supplier.id,
              notes: {
                contains: buildPurchaseImportMarker(record.blockId),
              },
            },
            select: { id: true },
          })
        : null

      if (existing) updates += 1
      else creates += 1
    }

    purchaseDryRunStats = { creates, updates }
  }

  if (!options.dryRun) {
    if (options.sections.has('costs')) {
      await applyCosts(prisma, costRecords)
    }
    if (options.sections.has('ads')) {
      adsApplyStats = await applyAds(prisma, adsRecords)
    }
    if (options.sections.has('purchases')) {
      purchaseApplyStats = await applyPurchases(prisma, purchaseRecords)
    }
  }

  const report: ImportReport = {
    generatedAt: new Date().toISOString(),
    sourceFile: stage.sourceFile,
    import: {
      dryRun: options.dryRun,
      sections: Array.from(options.sections),
      costs: {
        upserts: costRecords.length,
        skipped: skippedReasons.filter((reason) => reason.startsWith('costs:')).length,
      },
      ads: {
        creates: options.dryRun ? adsDryRunCreates : adsApplyStats.creates,
        skipped: skippedReasons.filter((reason) => reason.startsWith('ads:')).length,
      },
      purchases: {
        creates: options.dryRun ? purchaseDryRunStats.creates : purchaseApplyStats.creates,
        updates: options.dryRun ? purchaseDryRunStats.updates : purchaseApplyStats.updates,
        items: purchaseRecords.reduce((sum, record) => sum + record.items.length, 0),
        skipped: skippedReasons.filter((reason) => reason.startsWith('purchases:')).length,
      },
      skippedReasons,
    },
  }

  return {
    report,
    summary: {
      costRecords,
      adsRecords,
      purchaseRecords,
    },
  }
}
