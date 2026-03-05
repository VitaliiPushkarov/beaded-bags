import path from 'node:path'

import { PrismaClient } from '@prisma/client'

import { runGerdanImport } from '../../src/lib/imports/gerdan-importers'
import type {
  GerdanWorkbookStage,
  ImportOptions,
  ProductMappingFile,
} from '../../src/lib/imports/gerdan-types'
import {
  DEFAULT_MAPPING,
  DEFAULT_REPORT,
  DEFAULT_STAGE,
  getArgValue,
  hasFlag,
  loadProjectEnv,
  mergeReport,
  printSection,
  readJsonFile,
} from './helpers'

function parseSections(raw?: string): Set<'costs' | 'ads' | 'purchases'> {
  const allowed = new Set(['costs', 'ads', 'purchases'])
  const value = raw?.trim()
  if (!value) return new Set(['costs', 'ads', 'purchases'])

  const sections = new Set<'costs' | 'ads' | 'purchases'>()
  for (const section of value.split(',').map((entry) => entry.trim())) {
    if (!allowed.has(section)) {
      throw new Error(`Unsupported section "${section}"`)
    }
    sections.add(section as 'costs' | 'ads' | 'purchases')
  }

  return sections
}

async function main() {
  loadProjectEnv()

  const stagePath = path.resolve(getArgValue('--stage', DEFAULT_STAGE) ?? DEFAULT_STAGE)
  const mappingPath = path.resolve(getArgValue('--mapping', DEFAULT_MAPPING) ?? DEFAULT_MAPPING)
  const reportPath = path.resolve(getArgValue('--report', DEFAULT_REPORT) ?? DEFAULT_REPORT)
  const dryRun = !hasFlag('--apply')
  const sections = parseSections(getArgValue('--sections'))

  const stage = readJsonFile<GerdanWorkbookStage>(stagePath)
  const mapping = readJsonFile<ProductMappingFile>(mappingPath)

  const prisma = new PrismaClient()

  try {
    const result = await runGerdanImport({
      prisma,
      stage,
      mapping,
      options: {
        dryRun,
        sections,
      } satisfies ImportOptions,
    })

    mergeReport(reportPath, result.report)

    printSection('Import mode', {
      dryRun,
      sections: Array.from(sections),
      reportPath,
    })
    printSection('Summary', result.report.import)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Failed to import workbook into DB: ${message}`)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void main()
