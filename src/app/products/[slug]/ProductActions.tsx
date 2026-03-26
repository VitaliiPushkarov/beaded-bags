import type { AvailabilityStatus } from '@prisma/client'
import { isInStockStatus, isPreorderStatus } from '@/lib/availability'

export function ProductActions(props: {
  availabilityStatus: AvailabilityStatus
  onAddToCart: () => void
  onPreorder: () => void
  canSubmit?: boolean
}) {
  const { availabilityStatus, onAddToCart, onPreorder, canSubmit = true } = props
  const variantInStock = isInStockStatus(availabilityStatus)
  const variantPreorder = isPreorderStatus(availabilityStatus)

  if (variantInStock) {
    return (
      <button
        className={`mt-3 inline-flex items-center justify-center w-full h-10 px-5 text-[18px] py-2 transition ${
          canSubmit
            ? 'bg-black text-white hover:bg-[#FF3D8C] cursor-pointer'
            : 'bg-black text-white opacity-50 cursor-not-allowed'
        }`}
        onClick={onAddToCart}
        disabled={!canSubmit}
      >
        {canSubmit ? 'Додати в кошик' : 'Оберіть параметри'}
      </button>
    )
  }

  if (variantPreorder) {
    return (
      <button
        type="button"
        className={`mt-3 inline-flex items-center justify-center w-full h-10 border px-5 text-[18px] py-2 transition ${
          canSubmit
            ? 'border-black bg-black text-white hover:bg-[#FF3D8C] hover:border-[#FF3D8C] cursor-pointer'
            : 'border-black bg-black text-white opacity-50 cursor-not-allowed'
        }`}
        onClick={onPreorder}
        disabled={!canSubmit}
      >
        {canSubmit ? 'Передзамовити' : 'Оберіть параметри'}
      </button>
    )
  }

  return (
    <button
      className="mt-3 inline-flex items-center justify-center w-full h-10 bg-black text-white px-5 text-[18px] py-2 opacity-50 cursor-not-allowed"
      disabled
    >
      Немає в наявності
    </button>
  )
}
