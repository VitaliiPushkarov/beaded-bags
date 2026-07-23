import { Skeleton } from '@/components/ui/Skeleton'

// Instant fallback while a product page fetches its data (dynamically
// rendered because locale is resolved from the request host).
export default function ProductLoading() {
  return (
    <div className="max-w-[1440px] mx-auto py-6 px-5 md:px-[50px]">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div className="flex flex-col gap-4">
          <Skeleton className="aspect-square w-full" />
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-20" />
            ))}
          </div>
        </div>

        {/* Info column */}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="mt-4 flex gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-10 rounded-md" />
            ))}
          </div>
          <Skeleton className="mt-6 h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  )
}
