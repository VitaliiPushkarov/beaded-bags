import { unstable_cache } from 'next/cache'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  isPrismaAvailabilityError,
  withPrismaRetry,
} from '@/lib/prisma-resilience'
import {
  normalizeRecommendationMatrix,
  type RecommendationMatrix,
} from '@/lib/recommendation-matrix'

// The matrix is read on every product page, so it gets its own cache tag rather
// than riding along on HOME_CONFIG_CACHE_TAG. Admin writes bust it with
// revalidateTag(RECOMMENDATION_CACHE_TAG, 'max').
export const RECOMMENDATION_CACHE_TAG = 'recommendation-matrix'
const RECOMMENDATION_REVALIDATE_SECONDS = 300

async function queryRecommendationMatrix(): Promise<RecommendationMatrix> {
  try {
    const row = await withPrismaRetry(
      () =>
        prisma.recommendationSettings.findUnique({
          where: { id: 1 },
          select: { matrix: true },
        }),
      { scope: 'recommendationSettings.findUnique' },
    )

    return normalizeRecommendationMatrix(row?.matrix)
  } catch (error) {
    // P2021 is "table does not exist": the code is deployed but the migration
    // has not been applied yet. Falling back to the same-category defaults keeps
    // the block populated instead of breaking every product page until someone
    // runs the migration.
    const isMissingTable =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2021'

    if (isMissingTable || isPrismaAvailabilityError(error)) {
      console.error(
        '[db] Failed to load recommendation matrix from DB, using defaults.',
        error,
      )
      return normalizeRecommendationMatrix(null)
    }
    throw error
  }
}

export const getRecommendationMatrix = unstable_cache(
  queryRecommendationMatrix,
  ['recommendation-matrix'],
  {
    tags: [RECOMMENDATION_CACHE_TAG],
    revalidate: RECOMMENDATION_REVALIDATE_SECONDS,
  },
)
