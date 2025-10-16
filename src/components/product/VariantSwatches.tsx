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
        const disabled = !v.inStock
        return (
          <button
            key={v.id}
            role="radio"
            aria-checked={selected}
            disabled={!v.inStock}
            title={v.color + (!v.inStock ? ' — немає в наявності' : '')}
            onClick={() => v.inStock && onChange(v.id)}
            className={clsx(
              'relative grid place-items-center h-8 w-8 rounded-full bg-white transition',
              selected ? 'border-1 border-black' : 'border border-black/10',
              disabled && 'opacity-40 cursor-not-allowed',
              !disabled && 'cursor-pointer hover:scale-[1.03]'
            )}
          >
            <span
              aria-hidden
              className={clsx(
                'block rounded-full',
                // розмір внутрішнього кола — трохи менший за зовнішнє
                'h-5 w-5 md:h-[22px] md:w-[22px]',
                // легка внутрішня тінь для світлих кольорів
                'ring-1 ring-black/5'
              )}
              style={{ backgroundColor: v.hex }}
            />
            {/* фокус-індикатор доступності */}
            <span className="absolute inset-0 rounded-full ring-0 focus-visible:ring-2 focus-visible:ring-black/40" />
          </button>
        )
      })}
    </div>
  )
}
