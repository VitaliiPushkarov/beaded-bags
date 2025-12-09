'use client'
import type { ProductVariant } from '@prisma/client'
import clsx from 'clsx'

type Props = {
  variants: ProductVariant[]
  value: string
  onChange: (variantId: string) => void
}

export default function VariantSwatches({ variants, value, onChange }: Props) {
  return (
    <div role="radiogroup" className="flex gap-3 flex-wrap">
      {variants.map((v) => {
        const selected = v.id === value
        const disabled = !v.inStock

        return (
          <button
            key={v.id}
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => !disabled && onChange(v.id)}
            title={
              v.color ? v.color + (disabled ? ' — немає в наявності' : '') : ''
            }
            className={clsx(
              'relative grid place-items-center w-4 h-4 md:w-6 md:h-6  rounded-full  transition bg-white',
              'border',
              selected ? 'border-black' : 'border-black/10',
              disabled && 'opacity-40 cursor-not-allowed',
              !disabled && 'cursor-pointer hover:scale-[1.02]'
            )}
          >
            {/* кружечок кольору */}
            <span
              aria-hidden
              className="h-3 w-3 md:h-[18px] md:w-[18px] rounded-full ring-1 ring-black/5"
              style={{ backgroundColor: v.hex ?? '#E5E5E5' }}
            />

            {/* focus */}
            <span className="absolute inset-0 rounded-full ring-0 focus-visible:ring-2 focus-visible:ring-black/40" />
          </button>
        )
      })}
    </div>
  )
}
