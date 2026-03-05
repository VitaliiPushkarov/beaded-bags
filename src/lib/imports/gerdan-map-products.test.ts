import test from 'node:test'
import assert from 'node:assert/strict'

import { buildProductMapping, resolveMappedProductSlug } from './gerdan-map-products'
import type { GerdanWorkbookStage, ProductLookupRow } from './gerdan-types'

const stage: GerdanWorkbookStage = {
  sourceFile: '/tmp/source.xlsx',
  generatedAt: new Date().toISOString(),
  workbook: { sheetNames: ['Собівартість товарів'] },
  sheets: {
    dashboard: { metrics: [], rawRows: [] },
    purchases: { monthBlocks: [], rawRows: [] },
    ads: { rows: [], rawRows: [] },
    productCosts: {
      rows: [
        {
          sourceRow: 2,
          excelProductName: 'Рожева сумка бісер спортивна',
          excelModelName: 'Classic Mini',
          excelVariantName: 'Рожева',
          excelSize: '14 x 20 x 4 cm',
          materialsCostUAH: 100,
          laborCostUAH: 100,
          packagingCostUAH: 20,
          taxCostUAH: 10,
          adCostUAH: 5,
          totalCostUAH: 235,
          sitePriceUAH: 1799,
          raw: {},
        },
        {
          sourceRow: 3,
          excelProductName: 'Невідомий товар',
          excelModelName: 'Mystery',
          excelVariantName: null,
          excelSize: null,
          materialsCostUAH: 1,
          laborCostUAH: 1,
          packagingCostUAH: 1,
          taxCostUAH: 1,
          adCostUAH: 1,
          totalCostUAH: 5,
          sitePriceUAH: 100,
          raw: {},
        },
      ],
      rawRows: [],
    },
    workLog: { rows: [], rawRows: [] },
    workLedger: { rows: [], rawRows: [] },
    ignored: [],
  },
  summary: {
    purchasesRows: 0,
    adsRows: 0,
    productCostRows: 2,
    workRows: 0,
    unmatchedCostRows: 0,
    warnings: [],
  },
}

const products: ProductLookupRow[] = [
  {
    id: 'p1',
    slug: 'gerdan-classic-mini',
    name: 'Classic Mini',
    type: 'BAG',
    group: 'BEADS',
  },
]

test('buildProductMapping produces high-confidence exact matches', () => {
  const result = buildProductMapping(stage, products, stage.sourceFile)
  const matched = result.mapping.entries.find((entry) => entry.sourceRow === 2)
  assert.ok(matched)
  assert.equal(matched?.autoMatch.confidence, 'high')
  assert.equal(resolveMappedProductSlug(matched!), 'gerdan-classic-mini')
})

test('buildProductMapping marks unknown rows as unmatched', () => {
  const result = buildProductMapping(stage, products, stage.sourceFile)
  const unmatched = result.mapping.entries.find((entry) => entry.sourceRow === 3)
  assert.ok(unmatched)
  assert.equal(unmatched?.autoMatch.confidence, 'none')
  assert.equal(resolveMappedProductSlug(unmatched!), null)
})
