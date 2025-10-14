'use client'
import { ProductVariant } from '@/lib/products'
import clsx from 'clsx'

type Props = {
  variants: ProductVariant[]
  value: string // variantId
  onChange: (variantId: string) => void
}

export default function VariantSwatches({ variants, value, onChange }: Props) {
  return (
    <div role="radiogroup" className="flex gap-3">
      {variants.map((v) => {
        const selected = v.id === value
        return (
          <button
            key={v.id}
            role="radio"
            aria-checked={selected}
            disabled={!v.inStock}
            title={v.color + (!v.inStock ? ' — немає в наявності' : '')}
            onClick={() => v.inStock && onChange(v.id)}
            className={clsx(
              'relative h-8 w-8 rounded-full ring-1 ring-gray-300 transition',
              selected && 'ring-2 ring-black',
              !v.inStock && 'opacity-40 cursor-not-allowed'
            )}
            style={{ backgroundColor: v.hex }}
          >
            {/* біла обводка всередині для темних кольорів */}
            <span className="absolute inset-0 rounded-full ring-1 ring-black/5" />
          </button>
        )
      })}
    </div>
  )
}
