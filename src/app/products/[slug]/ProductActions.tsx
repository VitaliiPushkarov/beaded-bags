import type { AvailabilityStatus } from '@prisma/client'
import { isInStockStatus, isPreorderStatus } from '@/lib/availability'

export function ProductActions(props: {
  availabilityStatus: AvailabilityStatus
  onAddToCart: () => void
  onPreorder: () => void
}) {
  const { availabilityStatus, onAddToCart, onPreorder } = props
  const variantInStock = isInStockStatus(availabilityStatus)
  const variantPreorder = isPreorderStatus(availabilityStatus)

  if (variantInStock) {
    return (
      <button
        className="mt-3 inline-flex items-center justify-center w-full h-10 bg-black text-white px-5 text-[18px] py-2 hover:bg-[#FF3D8C] transition cursor-pointer"
        onClick={onAddToCart}
      >
        Додати в кошик
      </button>
    )
  }

  if (variantPreorder) {
    return (
      <button
        type="button"
        className="mt-3 inline-flex items-center justify-center w-full h-10 border border-black bg-black text-white px-5 text-[18px] py-2 hover:bg-[#FF3D8C] hover:border-[#FF3D8C] transition cursor-pointer"
        onClick={onPreorder}
      >
        Передзамовити
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
