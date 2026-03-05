export type CellValue = string | number | null

export type StageWarning = {
  sheet: string
  row?: number
  message: string
}

export type DashboardMetric = {
  label: string
  value: CellValue
}

export type DashboardStage = {
  metrics: DashboardMetric[]
  rawRows: Array<Record<string, CellValue>>
}

export type PurchaseStageRow = {
  sourceRow: number
  category: string | null
  name: string
  extraInfo: string | null
  colorOrForm: string | null
  packageCount: number | null
  unit: string | null
  quantity: number | null
  unitPriceUAH: number | null
  priceUSD: number | null
  totalUAH: number | null
  note: string | null
  raw: Record<string, CellValue>
}

export type PurchaseMonthBlock = {
  blockId: string
  monthLabel: string
  exchangeRate: number | null
  sourceHeaderRow: number
  items: PurchaseStageRow[]
}

export type PurchasesStage = {
  monthBlocks: PurchaseMonthBlock[]
  rawRows: Array<Record<string, CellValue>>
}

export type AdsStageRow = {
  sourceRow: number
  title: string
  account: string | null
  amountUSD: number | null
  amountUAH: number | null
  paymentSource: string | null
  raw: Record<string, CellValue>
  importable: boolean
  importSkipReason?: string
}

export type AdsStage = {
  rows: AdsStageRow[]
  rawRows: Array<Record<string, CellValue>>
}

export type ProductCostStageRow = {
  sourceRow: number
  excelProductName: string
  excelModelName: string | null
  excelVariantName: string | null
  excelSize: string | null
  materialsCostUAH: number
  laborCostUAH: number
  packagingCostUAH: number
  taxCostUAH: number
  adCostUAH: number
  totalCostUAH: number | null
  sitePriceUAH: number | null
  raw: Record<string, CellValue>
}

export type ProductCostsStage = {
  rows: ProductCostStageRow[]
  rawRows: Array<Record<string, CellValue>>
}

export type WorkLogRow = {
  sourceRow: number
  dateRaw: string | number | null
  master: string | null
  productName: string | null
  durationHours: number | null
  hourlyRateUAH: number | null
  totalUAH: number | null
  payment: string | null
  raw: Record<string, CellValue>
}

export type WorkLogStage = {
  rows: WorkLogRow[]
  rawRows: Array<Record<string, CellValue>>
}

export type WorkLedgerRow = {
  sourceRow: number
  dateRaw: string | number | null
  master: string | null
  productName: string | null
  quantity: number | null
  color: string | null
  amountPerUnitUAH: number | null
  totalUAH: number | null
  raw: Record<string, CellValue>
}

export type WorkLedgerStage = {
  rows: WorkLedgerRow[]
  rawRows: Array<Record<string, CellValue>>
}

export type IgnoredSheetStage = {
  sheetName: string
  reason: string
  rowCount: number
}

export type GerdanWorkbookStage = {
  sourceFile: string
  generatedAt: string
  workbook: {
    sheetNames: string[]
  }
  sheets: {
    dashboard: DashboardStage
    purchases: PurchasesStage
    ads: AdsStage
    productCosts: ProductCostsStage
    workLog: WorkLogStage
    workLedger: WorkLedgerStage
    ignored: IgnoredSheetStage[]
  }
  summary: {
    purchasesRows: number
    adsRows: number
    productCostRows: number
    workRows: number
    unmatchedCostRows: number
    warnings: StageWarning[]
  }
}

export type MappingConfidence = 'high' | 'medium' | 'low' | 'none'

export type ProductMatchCandidate = {
  productSlug: string
  productName: string
  score: number
  reason: string
}

export type ProductMappingEntry = {
  sourceSheet: 'Собівартість товарів'
  sourceRow: number
  excelProductName: string
  excelModelName: string | null
  excelVariantName: string | null
  normalizedKey: string
  autoMatch: {
    matched: boolean
    productSlug: string | null
    confidence: MappingConfidence
    reason: string
    candidates: ProductMatchCandidate[]
  }
  manualOverride: {
    productSlug: string | null
    notes: string | null
  }
}

export type ProductMappingFile = {
  generatedAt: string
  sourceFile: string
  defaults: {
    unmatchedPolicy: 'skip'
  }
  entries: ProductMappingEntry[]
}

export type ImportReport = {
  generatedAt: string
  sourceFile: string
  mapping?: {
    totalRows: number
    highConfidence: number
    mediumConfidence: number
    lowConfidence: number
    unmatched: number
    rowsRequiringManualOverride: number
  }
  import?: {
    dryRun: boolean
    sections: string[]
    costs: {
      upserts: number
      skipped: number
    }
    ads: {
      creates: number
      skipped: number
    }
    purchases: {
      creates: number
      updates: number
      items: number
      skipped: number
    }
    skippedReasons: string[]
  }
}

export type ProductLookupRow = {
  id: string
  slug: string
  name: string
  type?: string | null
  group?: string | null
}

export type ImportOptions = {
  dryRun: boolean
  sections: Set<'costs' | 'ads' | 'purchases'>
}
