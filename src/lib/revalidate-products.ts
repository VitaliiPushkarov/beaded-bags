import { revalidatePath } from 'next/cache'
import type { ProductGroup, ProductStatus, ProductType } from '@prisma/client'
import { getAccessorySubcategorySlugs } from '@/lib/shop-taxonomy'

const CATEGORY_BY_TYPE: Record<ProductType, string> = {
  BAG: 'sumky',
  BELT_BAG: 'bananky',
  BACKPACK: 'sumky',
  SHOPPER: 'shopery',
  CASE: 'chohly',
  ORNAMENTS: 'accessories',
  ACCESSORY: 'accessories',
}

const GROUP_SLUG_BY_GROUP: Record<ProductGroup, string> = {
  BEADS: 'beads',
  WEAVING: 'weaving',
}

const ACCESSORY_SUBCATEGORY_PATHS = getAccessorySubcategorySlugs().map(
  (slug) => `/shop/accessories/${slug}`,
)

type ProductRevalidatePayload = {
  slug?: string | null
  type?: ProductType | null
  group?: ProductGroup | null
  status?: ProductStatus | null
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
  if (snapshot.type === 'ACCESSORY' || snapshot.type === 'ORNAMENTS') {
    paths.add('/shop/accessories')
    for (const path of ACCESSORY_SUBCATEGORY_PATHS) paths.add(path)
  }
}

export function revalidateProductCache({ reason, before, after }: RevalidateInput) {
  const paths = new Set<string>()
  paths.add('/admin/products')
  paths.add('/admin/costs')

  const slugChanged = (before?.slug ?? null) !== (after?.slug ?? null)
  const typeChanged = (before?.type ?? null) !== (after?.type ?? null)
  const groupChanged = (before?.group ?? null) !== (after?.group ?? null)
  const statusChanged = (before?.status ?? null) !== (after?.status ?? null)

  // Always refresh affected PDP pages.
  addSnapshotPaths(paths, before)
  addSnapshotPaths(paths, after)

  // Taxonomy/list-level pages are refreshed on create/delete, and when product
  // moved between type/group buckets.
  if (reason !== 'update' || typeChanged || groupChanged || statusChanged) {
    paths.add('/shop')
  }

  // Product sitemap should refresh only when URL structure may change:
  // new product, deleted product, or slug changed.
  if (reason !== 'update' || slugChanged || statusChanged) {
    paths.add('/sitemap-products.xml')
  }

  for (const path of paths) revalidatePath(path)
}
