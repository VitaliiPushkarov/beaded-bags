import { ProductInteractive } from './ProductInteractive'
import type { ProductWithVariants } from './productTypes'

export function ProductClient({ p }: { p: ProductWithVariants }) {
  return <ProductInteractive p={p} />
}
