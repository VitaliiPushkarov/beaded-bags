import path from 'node:path'

import { parseGerdanWorkbook } from '../../src/lib/imports/gerdan-parse-xlsx'
import type { GerdanWorkbookStage } from '../../src/lib/imports/gerdan-types'
import {
  DEFAULT_SOURCE,
  DEFAULT_STAGE,
  getArgValue,
  printSection,
  writeJsonFile,
} from './helpers'

function main() {
  const source = path.resolve(getArgValue('--source', DEFAULT_SOURCE) ?? DEFAULT_SOURCE)
  const out = path.resolve(getArgValue('--out', DEFAULT_STAGE) ?? DEFAULT_STAGE)

  const stage: GerdanWorkbookStage = parseGerdanWorkbook(source)
  writeJsonFile(out, stage)

  printSection('Stage written', { source, out })
  printSection('Summary', stage.summary)
}

main()
