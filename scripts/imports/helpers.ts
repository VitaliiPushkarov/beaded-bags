import fs from 'node:fs'
import path from 'node:path'

import type { ImportReport } from '../../src/lib/imports/gerdan-types'

export const DEFAULT_SOURCE = path.join(
  process.cwd(),
  'beaded-bags/db/Gerdan виробництво.xlsx',
)
export const DEFAULT_STAGE = path.join(
  process.cwd(),
  'beaded-bags/db/staging/gerdan-production.staging.json',
)
export const DEFAULT_MAPPING = path.join(
  process.cwd(),
  'beaded-bags/db/mapping/gerdan-product-map.json',
)
export const DEFAULT_REPORT = path.join(
  process.cwd(),
  'beaded-bags/db/reports/gerdan-import-report.json',
)

export function loadProjectEnv() {
  const envFiles = ['.env', '.env.local', '.env.development.local']

  for (const fileName of envFiles) {
    const filePath = path.join(process.cwd(), fileName)
    if (!fs.existsSync(filePath)) continue

    const contents = fs.readFileSync(filePath, 'utf8')
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const separator = trimmed.indexOf('=')
      if (separator <= 0) continue

      const key = trimmed.slice(0, separator).trim()
      let value = trimmed.slice(separator + 1).trim()

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      process.env[key] = value
    }
  }
}

export function getArgValue(flag: string, fallback?: string): string | undefined {
  const arg = process.argv.find((entry) => entry.startsWith(`${flag}=`))
  if (arg) {
    return arg.slice(flag.length + 1)
  }

  const index = process.argv.indexOf(flag)
  if (index >= 0) {
    return process.argv[index + 1]
  }

  return fallback
}

export function hasFlag(flag: string): boolean {
  return process.argv.includes(flag) || process.argv.some((entry) => entry.startsWith(`${flag}=`))
}

export function ensureParentDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

export function writeJsonFile(filePath: string, value: unknown) {
  ensureParentDir(filePath)
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

export function mergeReport(
  reportPath: string,
  next: Partial<ImportReport>,
): ImportReport {
  const existing = fs.existsSync(reportPath)
    ? readJsonFile<ImportReport>(reportPath)
    : null

  const merged: ImportReport = {
    generatedAt: new Date().toISOString(),
    sourceFile: next.sourceFile ?? existing?.sourceFile ?? DEFAULT_SOURCE,
    mapping: next.mapping ?? existing?.mapping,
    import: next.import ?? existing?.import,
  }

  writeJsonFile(reportPath, merged)
  return merged
}

export function printSection(title: string, payload: unknown) {
  console.log(`\n=== ${title} ===`)
  console.log(JSON.stringify(payload, null, 2))
}
