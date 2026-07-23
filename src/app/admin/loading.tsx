import { Skeleton } from '@/components/ui/Skeleton'

// Instant fallback for admin sections, which are all force-dynamic and hit
// the database on every request. Applies to every /admin sub-route that does
// not define its own loading state.
export default function AdminLoading() {
  return (
    <div className="p-6">
      <Skeleton className="h-8 w-64 mb-6" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="mb-3 h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
