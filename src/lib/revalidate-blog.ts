import { revalidatePath } from 'next/cache'
import type { BlogPostStatus } from '@prisma/client'

type BlogRevalidateSnapshot = {
  slug?: string | null
  status?: BlogPostStatus | null
}

type BlogRevalidateInput = {
  before?: BlogRevalidateSnapshot | null
  after?: BlogRevalidateSnapshot | null
}

function addSnapshotPath(paths: Set<string>, snapshot?: BlogRevalidateSnapshot | null) {
  if (!snapshot?.slug) return
  paths.add(`/blog/${snapshot.slug}`)
}

export function revalidateBlogCache({ before, after }: BlogRevalidateInput = {}) {
  const paths = new Set<string>(['/blog', '/admin/blog', '/sitemap.xml'])

  addSnapshotPath(paths, before)
  addSnapshotPath(paths, after)

  for (const path of paths) {
    revalidatePath(path)
  }
}
