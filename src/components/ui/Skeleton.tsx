'use client'

type SkeletonProps = {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={
        'relative overflow-hidden rounded-sm bg-neutral-200 ' + className
      }
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-linear-to-r from-transparent via-white/70 to-transparent" />
    </div>
  )
}
