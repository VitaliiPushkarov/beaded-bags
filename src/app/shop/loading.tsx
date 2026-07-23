import { Skeleton } from '@/components/ui/Skeleton'

// Instant fallback while the (dynamically rendered) shop page fetches its
// catalog. Applies to /shop and its nested category/group routes.
export default function ShopLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Skeleton className="h-8 w-48 mb-6" />

      <div className="mb-8 flex flex-wrap gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-3/4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
