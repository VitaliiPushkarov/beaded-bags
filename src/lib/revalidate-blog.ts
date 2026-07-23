import { revalidatePath, revalidateTag } from 'next/cache'
import type { BlogPostStatus } from '@prisma/client'

import { BLOG_CACHE_TAG } from '@/lib/blog'

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

  // Bust the data-layer cache used by public blog reads (getBlogPosts /
  // getBlogPostBySlug), so published changes are reflected immediately even
  // though those routes are dynamically rendered. Called from Route Handlers,
  // so revalidateTag (not updateTag); "max" is Next 16's drop-in for the old
  // single-argument behavior.
  revalidateTag(BLOG_CACHE_TAG, 'max')
}
