export function ProductActions(props: {
  variantInStock: boolean
  onAddToCart: () => void
  onPreorder: () => void
}) {
  const { variantInStock, onAddToCart, onPreorder } = props

  return (
    <>
      <button
        className="mt-3 inline-flex items-center justify-center w-full h-10 bg-black text-white px-5 text-[18px] py-2 hover:bg-[#FF3D8C] transition disabled:opacity-50 cursor-pointer"
        disabled={!variantInStock}
        onClick={onAddToCart}
      >
        Додати в кошик
      </button>

      {!variantInStock && (
        <button
          type="button"
          className="mt-2 inline-flex items-center justify-center w-full h-10 border border-black bg-white text-black px-5 text-[18px] py-2 hover:bg-black hover:text-white transition cursor-pointer"
          onClick={onPreorder}
        >
          Передзамовити
        </button>
      )}
    </>
  )
}
