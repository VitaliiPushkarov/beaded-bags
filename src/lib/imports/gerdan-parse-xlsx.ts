import path from 'node:path'

import * as XLSX from 'xlsx'

import {
  cleanString,
  parseOptionalNumber,
  parseRequiredNumber,
} from './gerdan-normalize'
import type {
  AdsStage,
  AdsStageRow,
  CellValue,
  DashboardStage,
  GerdanWorkbookStage,
  IgnoredSheetStage,
  ProductCostsStage,
  ProductCostStageRow,
  PurchasesStage,
  PurchaseMonthBlock,
  PurchaseStageRow,
  StageWarning,
  WorkLedgerRow,
  WorkLedgerStage,
  WorkLogRow,
  WorkLogStage,
} from './gerdan-types'

type RowArray = Array<CellValue>

const PURCHASE_HEADERS = [
  'Дата',
  'Категорія',
  'Найменування',
  'Дод. Інформація',
  'Колір / Форма',
  'К-сть упаковок',
  'Од. виміру',
  'Кількість',
  'Ціна за од.',
  'Ціна, $',
  'Сума, грн',
  'Примітка',
] as const

function readSheetRows(workbook: XLSX.WorkBook, sheetName: string): RowArray[] {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json<RowArray>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  })

  return rows.map((row) => row as RowArray)
}

function rowToRecord(row: RowArray): Record<string, CellValue> {
  const record: Record<string, CellValue> = {}

  row.forEach((value, index) => {
    const key = XLSX.utils.encode_col(index)
    record[key] = value ?? null
  })

  return record
}

function isEmptyRow(row: RowArray): boolean {
  return row.every((cell) => cleanString(cell) === '')
}

function parseDashboard(rows: RowArray[]): DashboardStage {
  const header = rows[0] ?? []
  const values = rows[1] ?? []

  return {
    metrics: header
      .map((label, index) => ({
        label: cleanString(label),
        value: values[index] ?? null,
      }))
      .filter((metric) => metric.label.length > 0),
    rawRows: rows.map(rowToRecord),
  }
}

function parsePurchases(
  rows: RowArray[],
  warnings: StageWarning[],
): PurchasesStage {
  const monthBlocks: PurchaseMonthBlock[] = []
  let currentBlock: PurchaseMonthBlock | null = null
  let purchaseHeaderSeen = false

  rows.forEach((row, index) => {
    const sourceRow = index + 1
    const colA = cleanString(row[0])
    const colB = cleanString(row[1])
    const colC = cleanString(row[2])

    if (colA.toLowerCase().startsWith('курс долара')) {
      const exchangeRate = parseOptionalNumber(row[1])
      const monthLabel = cleanString(row[2])

      currentBlock = {
        blockId: `purchases-${sourceRow}`,
        monthLabel,
        exchangeRate,
        sourceHeaderRow: sourceRow,
        items: [],
      }
      monthBlocks.push(currentBlock)
      return
    }

    if (
      PURCHASE_HEADERS.every((header, headerIndex) =>
        cleanString(row[headerIndex]).startsWith(header),
      )
    ) {
      purchaseHeaderSeen = true
      return
    }

    if (!currentBlock || !purchaseHeaderSeen || isEmptyRow(row)) {
      return
    }

    if (!colB && !colC) return

    const item: PurchaseStageRow = {
      sourceRow,
      category: colB || null,
      name: colC,
      extraInfo: cleanString(row[3]) || null,
      colorOrForm: cleanString(row[4]) || null,
      packageCount: parseOptionalNumber(row[5]),
      unit: cleanString(row[6]) || null,
      quantity: parseOptionalNumber(row[7]),
      unitPriceUAH: parseOptionalNumber(row[8]),
      priceUSD: parseOptionalNumber(row[9]),
      totalUAH: parseOptionalNumber(row[10]),
      note: cleanString(row[11]) || null,
      raw: rowToRecord(row),
    }

    if (!item.name) {
      warnings.push({
        sheet: 'Закупівлі',
        row: sourceRow,
        message: 'Skipped purchase row without item name',
      })
      return
    }

    currentBlock.items.push(item)
  })

  return {
    monthBlocks,
    rawRows: rows.map(rowToRecord),
  }
}

function parseAds(rows: RowArray[]): AdsStage {
  const dataRows: AdsStageRow[] = []

  rows.forEach((row, index) => {
    const sourceRow = index + 1
    const title = cleanString(row[1])

    if (!title || title === 'Найменування') return

    const amountUSD = parseOptionalNumber(row[3])
    const amountUAH = parseOptionalNumber(row[8]) ?? parseOptionalNumber(row[9])
    const importable = amountUAH != null

    dataRows.push({
      sourceRow,
      title,
      account: cleanString(row[2]) || null,
      amountUSD,
      amountUAH,
      paymentSource: cleanString(row[7]) || null,
      raw: rowToRecord(row),
      importable,
      importSkipReason: importable
        ? undefined
        : 'Missing reliable amount in UAH',
    })
  })

  return {
    rows: dataRows,
    rawRows: rows.map(rowToRecord),
  }
}

function parseProductCosts(rows: RowArray[]): ProductCostsStage {
  const parsedRows: ProductCostStageRow[] = []

  rows.forEach((row, index) => {
    const sourceRow = index + 1
    const productName = cleanString(row[0])
    if (!productName || productName === 'Назва товару') return

    parsedRows.push({
      sourceRow,
      excelProductName: productName,
      excelModelName: cleanString(row[12]) || null,
      excelVariantName: cleanString(row[13]) || null,
      excelSize: cleanString(row[14]) || null,
      materialsCostUAH: parseRequiredNumber(row[1], 0),
      laborCostUAH: parseRequiredNumber(row[2], 0),
      packagingCostUAH: parseRequiredNumber(row[3], 0),
      taxCostUAH: parseRequiredNumber(row[5], 0),
      adCostUAH: parseRequiredNumber(row[6], 0),
      totalCostUAH: parseOptionalNumber(row[7]),
      sitePriceUAH: parseOptionalNumber(row[19]),
      raw: rowToRecord(row),
    })
  })

  return {
    rows: parsedRows,
    rawRows: rows.map(rowToRecord),
  }
}

function parseWorkLog(rows: RowArray[]): WorkLogStage {
  const parsedRows: WorkLogRow[] = []

  rows.forEach((row, index) => {
    const sourceRow = index + 1
    const master = cleanString(row[1])
    const productName = cleanString(row[2])

    if (!master && !productName) return
    if (master === 'Майстер' && productName === 'Найменування виробу') return

    parsedRows.push({
      sourceRow,
      dateRaw: row[0] ?? null,
      master: master || null,
      productName: productName || null,
      durationHours: parseOptionalNumber(row[3]),
      hourlyRateUAH: parseOptionalNumber(row[4]),
      totalUAH: parseOptionalNumber(row[5]),
      payment: cleanString(row[6]) || null,
      raw: rowToRecord(row),
    })
  })

  return {
    rows: parsedRows,
    rawRows: rows.map(rowToRecord),
  }
}

function parseWorkLedger(rows: RowArray[]): WorkLedgerStage {
  const parsedRows: WorkLedgerRow[] = []

  rows.forEach((row, index) => {
    const sourceRow = index + 1
    const master = cleanString(row[1])
    const productName = cleanString(row[2])

    if (!master && !productName) return
    if (cleanString(row[0]) === 'Дата' && master === 'Майстер') return

    parsedRows.push({
      sourceRow,
      dateRaw: row[0] ?? null,
      master: master || null,
      productName: productName || null,
      quantity: parseOptionalNumber(row[3]),
      color: cleanString(row[4]) || null,
      amountPerUnitUAH: parseOptionalNumber(row[5]),
      totalUAH: parseOptionalNumber(row[6]),
      raw: rowToRecord(row),
    })
  })

  return {
    rows: parsedRows,
    rawRows: rows.map(rowToRecord),
  }
}

export function parseGerdanWorkbook(sourceFile: string): GerdanWorkbookStage {
  const workbook = XLSX.readFile(sourceFile, {
    cellDates: false,
    dense: false,
    raw: true,
  })

  const warnings: StageWarning[] = []
  const ignored: IgnoredSheetStage[] = []
  const sheetNames = workbook.SheetNames

  const dashboardRows = readSheetRows(workbook, 'Дашборд')
  const purchasesRows = readSheetRows(workbook, 'Закупівлі')
  const adsRows = readSheetRows(workbook, 'реклама')
  const productCostsRows = readSheetRows(workbook, 'Собівартість товарів')
  const workLogRows = readSheetRows(workbook, 'Робота')
  const workLedgerRows = readSheetRows(workbook, 'Лист2')

  sheetNames.forEach((sheetName) => {
    if (
      [
        'Дашборд',
        'Закупівлі',
        'реклама',
        'Собівартість товарів',
        'Робота',
        'Лист2',
      ].includes(sheetName)
    ) {
      return
    }

    const rows = readSheetRows(workbook, sheetName)
    ignored.push({
      sheetName,
      reason: rows.length === 0 ? 'empty_sheet' : 'not_imported',
      rowCount: rows.length,
    })
  })

  const stage: GerdanWorkbookStage = {
    sourceFile: path.resolve(sourceFile),
    generatedAt: new Date().toISOString(),
    workbook: {
      sheetNames,
    },
    sheets: {
      dashboard: parseDashboard(dashboardRows),
      purchases: parsePurchases(purchasesRows, warnings),
      ads: parseAds(adsRows),
      productCosts: parseProductCosts(productCostsRows),
      workLog: parseWorkLog(workLogRows),
      workLedger: parseWorkLedger(workLedgerRows),
      ignored,
    },
    summary: {
      purchasesRows: 0,
      adsRows: 0,
      productCostRows: 0,
      workRows: 0,
      unmatchedCostRows: 0,
      warnings,
    },
  }

  stage.summary.purchasesRows = stage.sheets.purchases.monthBlocks.reduce(
    (sum, block) => sum + block.items.length,
    0,
  )
  stage.summary.adsRows = stage.sheets.ads.rows.length
  stage.summary.productCostRows = stage.sheets.productCosts.rows.length
  stage.summary.workRows =
    stage.sheets.workLog.rows.length + stage.sheets.workLedger.rows.length

  return stage
}
