export type AdminPagination = {
  page: number
  pageSize: number
  skip: number
  take: number
}

// Parse a `page` search param into a safe 1-based pagination window.
export function resolvePagination(
  pageParam: string | string[] | undefined,
  pageSize = 50,
): AdminPagination {
  const raw = Array.isArray(pageParam) ? pageParam[0] : pageParam
  const parsed = Number.parseInt(String(raw ?? '1'), 10)
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

export function totalPageCount(totalCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, totalCount) / Math.max(1, pageSize)))
}
