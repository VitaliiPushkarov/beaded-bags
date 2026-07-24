'use client'
import type { AvailabilityStatus } from '@prisma/client'
import clsx from 'clsx'
import {
  isOutOfStockStatus,
  isPreorderStatus,
  resolveAvailabilityStatus,
} from '@/lib/availability'

type SwatchVariant = {
  id: string
  color: string | null
  hex: string | null
  inStock: boolean
  availabilityStatus: AvailabilityStatus
}

type Props = {
  variants: SwatchVariant[]
  value: string
  onChange: (variantId: string) => void
  size?: 'compact' | 'large'
}

export default function VariantSwatches({
  variants,
  value,
  onChange,
  size = 'compact',
}: Props) {
  const isLarge = size === 'large'

  return (
    <div
      role="radiogroup"
      className={clsx('flex flex-wrap', isLarge ? 'gap-2' : 'gap-3')}
    >
      {variants.map((v) => {
        const selected = v.id === value
        const availabilityStatus = resolveAvailabilityStatus({
          availabilityStatus: (v as any).availabilityStatus,
          inStock: v.inStock,
        })
        const outOfStock = isOutOfStockStatus(availabilityStatus)
        const preorder = isPreorderStatus(availabilityStatus)

        return (
          <button
            key={v.id}
            role="radio"
            aria-checked={selected}
            aria-disabled={outOfStock}
            onClick={() => onChange(v.id)}
            title={
              v.color
                ? v.color +
                  (outOfStock
                    ? ' — немає в наявності'
                    : preorder
                      ? ' — доступно до передзамовлення'
                      : '')
                : ''
            }
            className={clsx(
              'relative grid place-items-center rounded-full bg-white p-1 transition',
              isLarge ? 'h-10 w-10' : 'h-8 w-8 md:h-9 md:w-9',
              'border',
              selected
                ? 'border-black ring-2 ring-black/10'
                : preorder
                  ? 'border-gray-200'
                  : 'border-gray-300',
              outOfStock && 'opacity-40',
              'cursor-pointer hover:scale-[1.02]',
            )}
          >
            <span
              aria-hidden
              className="h-full w-full rounded-full ring-1 ring-black/5"
              style={{ backgroundColor: v.hex ?? '#E5E5E5' }}
            />
            {outOfStock && (
              <span
                aria-hidden
                className="absolute inset-1 rounded-full"
                style={{
                  background:
                    'linear-gradient(135deg, transparent 47%, rgba(0,0,0,0.35) 47%, rgba(0,0,0,0.35) 53%, transparent 53%)',
                }}
              />
            )}

            <span className="absolute inset-0 rounded-full ring-0 focus-visible:ring-2 focus-visible:ring-black/40" />
          </button>
        )
      })}
    </div>
  )
}
