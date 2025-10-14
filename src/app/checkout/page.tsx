// Checkout page

'use client'
import { useState } from 'react'
import { useCart } from '../store/cart'

export default function CheckoutPage() {
  const cart = useCart()
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    warehouse: '',
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // 1) створюємо замовлення
    const orderRes = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.items,
        amountUAH: cart.total(),
        customer: form,
      }),
    })
    const order = await orderRes.json()

    // 2) MOCK оплата -> success
    const payRes = await fetch('/api/payments/mock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id }),
    })
    const pay = await payRes.json()
    window.location.href = pay.url
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Оформлення замовлення</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        {['name', 'phone', 'email', 'city', 'warehouse'].map((k) => (
          <input
            key={k}
            name={k}
            placeholder={
              {
                name: 'Ім’я',
                phone: 'Телефон',
                email: 'Email',
                city: 'Місто',
                warehouse: 'Відділення Нової Пошти',
              }[k as keyof typeof form]
            }
            onChange={handleChange}
            required
            className="w-full border rounded p-2"
          />
        ))}
        <button
          disabled={loading}
          type="submit"
          className="w-full bg-black text-white py-2 rounded"
        >
          {loading ? 'Обробка...' : `Оплатити ${cart.total()} грн`}
        </button>
      </form>
    </div>
  )
}
