import { revalidatePath } from 'next/cache'
import type { ProductGroup, ProductType } from '@prisma/client'

const CATEGORY_BY_TYPE: Record<ProductType, string> = {
  BAG: 'sumky',
  BELT_BAG: 'bananky',
  BACKPACK: 'rjukzachky',
  SHOPPER: 'shopery',
  CASE: 'chohly',
  ORNAMENTS: 'prykrasy',
  ACCESSORY: 'accessories',
}

const GROUP_SLUG_BY_GROUP: Record<ProductGroup, string> = {
  BEADS: 'beads',
  WEAVING: 'weaving',
}

type ProductRevalidatePayload = {
  slug?: string | null
  type?: ProductType | null
  group?: ProductGroup | null
}

type RevalidateReason = 'create' | 'update' | 'delete'

type RevalidateInput = {
  reason: RevalidateReason
  before?: ProductRevalidatePayload | null
  after?: ProductRevalidatePayload | null
}

function addSnapshotPaths(paths: Set<string>, snapshot?: ProductRevalidatePayload | null) {
  if (!snapshot) return

  if (snapshot.slug) paths.add(`/products/${snapshot.slug}`)
  if (snapshot.type) paths.add(`/shop/${CATEGORY_BY_TYPE[snapshot.type]}`)
  if (snapshot.group) paths.add(`/shop/group/${GROUP_SLUG_BY_GROUP[snapshot.group]}`)
}

export function revalidateProductCache({ reason, before, after }: RevalidateInput) {
  const paths = new Set<string>()

  const slugChanged = (before?.slug ?? null) !== (after?.slug ?? null)
  const typeChanged = (before?.type ?? null) !== (after?.type ?? null)
  const groupChanged = (before?.group ?? null) !== (after?.group ?? null)

  // Always refresh affected PDP pages.
  addSnapshotPaths(paths, before)
  addSnapshotPaths(paths, after)

  // Taxonomy/list-level pages are refreshed on create/delete, and when product
  // moved between type/group buckets.
  if (reason !== 'update' || typeChanged || groupChanged) {
    paths.add('/shop')
  }

  // Product sitemap should refresh only when URL structure may change:
  // new product, deleted product, or slug changed.
  if (reason !== 'update' || slugChanged) {
    paths.add('/sitemap-products.xml')
  }

  for (const path of paths) revalidatePath(path)
}
