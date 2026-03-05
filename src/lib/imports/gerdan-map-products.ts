import { buildNormalizedKey, normalizeSearchString, uniqueTokens } from './gerdan-normalize'
import type {
  GerdanWorkbookStage,
  ImportReport,
  MappingConfidence,
  ProductLookupRow,
  ProductMappingEntry,
  ProductMappingFile,
  ProductMatchCandidate,
} from './gerdan-types'

type ScoredCandidate = ProductMatchCandidate & {
  confidence: MappingConfidence
}

function scoreCandidate(
  sourceNames: string[],
  product: ProductLookupRow,
): ScoredCandidate | null {
  const productNameNorm = normalizeSearchString(product.name)
  const productSlugNorm = normalizeSearchString(product.slug)

  let bestScore = 0
  let reason = ''

  for (const sourceName of sourceNames) {
    if (!sourceName) continue

    if (sourceName === productNameNorm) {
      bestScore = Math.max(bestScore, 100)
      reason = 'exact model-to-name match'
    }

    if (sourceName === productSlugNorm) {
      bestScore = Math.max(bestScore, 95)
      reason = reason || 'exact model-to-slug match'
    }

    const sourceTokens = uniqueTokens(sourceName)
    const productTokens = uniqueTokens(product.name)

    const overlap = sourceTokens.filter((token) => productTokens.includes(token))
    if (overlap.length > 0) {
      const ratio = overlap.length / Math.max(sourceTokens.length, 1)
      const tokenScore = Math.round(ratio * 80)
      if (tokenScore > bestScore) {
        bestScore = tokenScore
        reason = `token overlap: ${overlap.join(', ')}`
      }
    }
  }

  if (bestScore <= 0) return null

  const confidence: MappingConfidence =
    bestScore >= 95 ? 'high' : bestScore >= 70 ? 'medium' : 'low'

  return {
    productSlug: product.slug,
    productName: product.name,
    score: bestScore,
    reason,
    confidence,
  }
}

function resolveAutoMatch(candidates: ScoredCandidate[]): {
  matched: boolean
  productSlug: string | null
  confidence: MappingConfidence
  reason: string
} {
  if (candidates.length === 0) {
    return {
      matched: false,
      productSlug: null,
      confidence: 'none',
      reason: 'No candidates found',
    }
  }

  const [best, second] = candidates

  if (best.confidence === 'high' && (!second || best.score - second.score >= 10)) {
    return {
      matched: true,
      productSlug: best.productSlug,
      confidence: 'high',
      reason: best.reason,
    }
  }

  if (best.confidence === 'medium' && (!second || best.score - second.score >= 15)) {
    return {
      matched: true,
      productSlug: best.productSlug,
      confidence: 'medium',
      reason: best.reason,
    }
  }

  return {
    matched: false,
    productSlug: null,
    confidence: best.confidence,
    reason: second
      ? `Ambiguous candidates: ${best.productSlug} vs ${second.productSlug}`
      : best.reason,
  }
}

export function buildProductMapping(
  stage: GerdanWorkbookStage,
  products: ProductLookupRow[],
  sourceFile: string,
  existingMapping?: ProductMappingFile | null,
): {
  mapping: ProductMappingFile
  report: ImportReport
} {
  const existingByRow = new Map(
    (existingMapping?.entries ?? []).map((entry) => [entry.sourceRow, entry]),
  )
  const existingByKey = new Map(
    (existingMapping?.entries ?? []).map((entry) => [entry.normalizedKey, entry]),
  )

  const entries: ProductMappingEntry[] = stage.sheets.productCosts.rows.map((row) => {
    const sourceNames = [
      normalizeSearchString(row.excelModelName),
      normalizeSearchString(row.excelProductName),
      normalizeSearchString(row.excelVariantName),
    ].filter(Boolean)

    const candidates = products
      .map((product) => scoreCandidate(sourceNames, product))
      .filter((candidate): candidate is ScoredCandidate => Boolean(candidate))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    const autoMatch = resolveAutoMatch(candidates)

    const normalizedKey = buildNormalizedKey(row)
    const existingEntry =
      existingByRow.get(row.sourceRow) ?? existingByKey.get(normalizedKey)

    return {
      sourceSheet: 'Собівартість товарів',
      sourceRow: row.sourceRow,
      excelProductName: row.excelProductName,
      excelModelName: row.excelModelName,
      excelVariantName: row.excelVariantName,
      normalizedKey,
      autoMatch: {
        ...autoMatch,
        candidates: candidates.map((candidate) => ({
          productSlug: candidate.productSlug,
          productName: candidate.productName,
          score: candidate.score,
          reason: candidate.reason,
        })),
      },
      manualOverride: {
        productSlug: existingEntry?.manualOverride.productSlug ?? null,
        notes: existingEntry?.manualOverride.notes ?? null,
      },
    }
  })

  const report: ImportReport = {
    generatedAt: new Date().toISOString(),
    sourceFile,
    mapping: {
      totalRows: entries.length,
      highConfidence: entries.filter(
        (entry) => entry.autoMatch.confidence === 'high',
      ).length,
      mediumConfidence: entries.filter(
        (entry) => entry.autoMatch.confidence === 'medium',
      ).length,
      lowConfidence: entries.filter(
        (entry) => entry.autoMatch.confidence === 'low',
      ).length,
      unmatched: entries.filter(
        (entry) => entry.autoMatch.confidence === 'none',
      ).length,
      rowsRequiringManualOverride: entries.filter(
        (entry) =>
          !entry.autoMatch.matched || entry.autoMatch.confidence !== 'high',
      ).length,
    },
  }

  return {
    mapping: {
      generatedAt: new Date().toISOString(),
      sourceFile,
      defaults: {
        unmatchedPolicy: 'skip',
      },
      entries,
    },
    report,
  }
}

export function resolveMappedProductSlug(entry: ProductMappingEntry): string | null {
  if (entry.manualOverride.productSlug) return entry.manualOverride.productSlug
  if (entry.autoMatch.matched && entry.autoMatch.confidence === 'high') {
    return entry.autoMatch.productSlug
  }
  return null
}
