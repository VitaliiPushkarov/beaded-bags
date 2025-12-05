'use client'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '../store/cart'

function QtyBox({
  onDec,
  onInc,
  value,
}: {
  onDec: () => void
  onInc: () => void
  value: number
}) {
  return (
    <div
      className="
      inline-flex items-center gap-3 px-3 py-2.5
      border border-black rounded
      text-lg 
    "
    >
      <button
        onClick={onDec}
        aria-label="Менше"
        className="text-2xl leading-none cursor-pointer"
      >
        −
      </button>
      <span className="w-6 text-center">{value}</span>
      <button
        onClick={onInc}
        aria-label="Більше"
        className="text-2xl leading-none cursor-pointer"
      >
        ＋
      </button>
    </div>
  )
}

const useCartItems = () => useCart((s) => s.items)
const useCartSetQty = () => useCart((s) => s.setQty)
const useCartRemove = () => useCart((s) => s.remove)
const useCartTotal = () => useCart((s) => s.total)

export default function CartPage() {
  const items = useCartItems()
  const setQty = useCartSetQty()
  const remove = useCartRemove()
  const total = useCartTotal()

  return (
    <section className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6 lg:py-12">
      <h1 className="text-4xl lg:text-5xl font-fixel-display mb-8">Кошик</h1>

      <div className="grid lg:grid-cols-[1fr_460px] gap-10">
        {/* LEFT: таблиця */}
        <div>
          {/* заголовки таблиці */}
          <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr] gap-6 uppercase tracking-wide text-sm pb-3 border-b border-black ">
            <div>Товар</div>
            <div className="text-center">Ціна</div>
            <div className="text-center">Кількість</div>
            <div className="text-right">Разом</div>
          </div>

          {/* рядки */}
          <div className="divide-y">
            {items.map((it) => {
              const line = it.priceUAH * it.qty
              return (
                <div
                  key={`${it.productId}-${it.variantId}`}
                  className="py-6 grid lg:grid-cols-[2fr_1fr_1fr_1fr] gap-6 items-center border-b border-black"
                >
                  {/* Товар */}
                  <div className="flex items-start gap-6 min-w-0">
                    <div className="relative h-[120px] w-[120px] bg-gray-100 rounded overflow-hidden shrink-0">
                      <Image
                        src={it.image}
                        alt={it.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex flex-col items-start flex-wrap">
                      <Link
                        href={`/products/${it.slug}`}
                        className="block text-xl hover:underline"
                      >
                        {it.name}
                      </Link>
                      <div className="mt-2 text-gray-700">В наявності</div>
                      <button
                        onClick={() => remove(it.productId, it.variantId)}
                        className="mt-3 text-black underline underline-offset-4 hover:no-underline cursor-pointer"
                      >
                        Видалити
                      </button>
                    </div>
                  </div>

                  {/* Ціна */}
                  <div className="lg:text-center text-xl">
                    {it.priceUAH} грн
                  </div>

                  {/* Кількість */}
                  <div className="lg:text-center">
                    <QtyBox
                      value={it.qty}
                      onDec={() => {
                        const n = it.qty - 1
                        if (n <= 0) {
                          remove(it.productId, it.variantId)
                        } else {
                          setQty(it.productId, it.variantId, n)
                        }
                      }}
                      onInc={() =>
                        setQty(it.productId, it.variantId, it.qty + 1)
                      }
                    />
                  </div>

                  {/* Разом */}
                  <div className="lg:text-right text-xl font-medium">
                    {line} грн
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: сума замовлення */}
        <aside className="h-fit lg:sticky lg:top-8 border border-black rounded p-6 space-y-6 ">
          <h2 className="text-2xl font-fixel-display">Сума замовлення</h2>

          <div className="flex items-center justify-between text-lg">
            <span>Вартість замовлення</span>
            <span className="font-semibold">{total()} грн</span>
          </div>

          <div>
            <div className="text-sm uppercase tracking-wide text-gray-700">
              Доставка
            </div>
            <div className="mt-2">Нова Пошта</div>
          </div>

          <div>
            <label className="block text-sm text-gray-700">Є промокод?</label>
            <div className="mt-2 flex">
              <input
                className="flex-1 border border-black rounded-l px-3 py-2 outline-none"
                placeholder="Введіть код"
              />
              <button className="px-5 border border-l-0 border-black rounded-r hover:bg-black hover:text-white transition cursor-pointer">
                →
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xl pt-2">
            <span className="uppercase tracking-wide">Разом</span>
            <span className="font-semibold">{total()} грн</span>
          </div>
          <div className="w-full">
            <Link
              href="/checkout"
              className="flex justify-center items-center w-full h-14 text-lg rounded bg-black text-white hover:bg-[#FF3D8C] transition cursor-pointer"
            >
              Перейти до оформлення
            </Link>
          </div>
        </aside>
      </div>
    </section>
  )
}
