import path from 'node:path'
import fs from 'node:fs'

import { PrismaClient } from '@prisma/client'

import { buildProductMapping } from '../../src/lib/imports/gerdan-map-products'
import type {
  GerdanWorkbookStage,
  ProductLookupRow,
  ProductMappingFile,
} from '../../src/lib/imports/gerdan-types'
import {
  DEFAULT_MAPPING,
  DEFAULT_REPORT,
  DEFAULT_STAGE,
  getArgValue,
  loadProjectEnv,
  mergeReport,
  printSection,
  readJsonFile,
  writeJsonFile,
} from './helpers'

async function main() {
  loadProjectEnv()

  const stagePath = path.resolve(getArgValue('--stage', DEFAULT_STAGE) ?? DEFAULT_STAGE)
  const outPath = path.resolve(getArgValue('--out', DEFAULT_MAPPING) ?? DEFAULT_MAPPING)
  const reportPath = path.resolve(getArgValue('--report', DEFAULT_REPORT) ?? DEFAULT_REPORT)
  const stage = readJsonFile<GerdanWorkbookStage>(stagePath)
  const prisma = new PrismaClient()

  try {
    const products = (await prisma.product.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        group: true,
      },
      orderBy: [{ name: 'asc' }],
    })) as ProductLookupRow[]

    const existingMapping = fs.existsSync(outPath)
      ? readJsonFile<ProductMappingFile>(outPath)
      : null

    const { mapping, report } = buildProductMapping(
      stage,
      products,
      stage.sourceFile,
      existingMapping,
    )

    writeJsonFile(outPath, mapping)
    mergeReport(reportPath, report)

    printSection('Mapping written', { outPath, reportPath })
    printSection('Mapping summary', report.mapping)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Failed to build mapping: ${message}`)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void main()
