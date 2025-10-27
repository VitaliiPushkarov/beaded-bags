'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NovaPoshtaPicker from '@/components/checkout/NovaPoshtaPicker'
import { useCart } from '../store/cart'
import { useCheckout } from '@/stores/checkout'

export default function CheckoutClient() {
  const router = useRouter()

  // локальна форма покупця
  const [form, setForm] = useState({
    name: '',
    surname: '',
    patronymic: '',
    phone: '',
    email: '',
  })

  const [touched, setTouched] = useState({
    name: false,
    surname: false,
    patronymic: false,
    phone: false,
    email: false,
  })

  const lettersOnly = (s: string) =>
    s.replace(/[^A-Za-zА-Яа-яЁёІіЇїЄєҐґ' -]/gu, '')

  const normalizeUaPhone = (s: string) => {
    let d = s.replace(/\D/g, '') // only digits
    // if starts with 0 -> replace leading 0 with 380
    if (d.startsWith('0')) d = '380' + d.slice(1)
    // if starts with 80 (old habit) -> prefix 3
    if (d.startsWith('80')) d = '3' + d
    // limit to 12 digits total
    if (d.length > 12) d = d.slice(0, 12)
    return d
  }

  const isNameValid = (s: string) => lettersOnly(s).trim().length >= 2
  const isEmailValid = (s: string) => !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
  const isUaPhoneValid = (d: string) =>
    /^\d{12}$/.test(d) && d.startsWith('380')

  const inputClass = (ok: boolean, wasTouched: boolean) =>
    'mt-1 w-full rounded border px-3 py-2 outline-none ' +
    (wasTouched
      ? ok
        ? 'border-emerald-500'
        : 'border-rose-500'
      : 'border-gray-300')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // дані з наших сторів
  const cart = useCart()
  const co = useCheckout()

  const submitOrder = async () => {
    setError(null)
    const fioValid =
      isNameValid(form.name) &&
      isNameValid(form.surname) &&
      isNameValid(form.patronymic)
    const phoneNorm = normalizeUaPhone(form.phone)
    const phoneValid = isUaPhoneValid(phoneNorm)
    const emailValid = isEmailValid(form.email)

    if (!fioValid || !phoneValid || !emailValid) {
      setTouched({
        name: true,
        surname: true,
        patronymic: true,
        phone: true,
        email: true,
      })
      setError('Перевірте правильність полів форми')
      return
    }
    if (!co.np.cityRef || !co.np.warehouseRef) {
      setError('Оберіть місто та відділення Нової Пошти')
      return
    }
    if (cart.items.length === 0) {
      setError('Кошик порожній')
      return
    }

    const items = cart.items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId,
      name: it.name,
      image: it.image,
      priceUAH: it.priceUAH,
      qty: it.qty,
    }))

    const subtotal = items.reduce((s, it) => s + it.priceUAH * it.qty, 0)
    const shipping = 0 // TODO: розрахунок тарифу
    const total = subtotal + shipping

    setLoading(true)
    try {
      const emailClean = form.email.trim()
      const customer: { name: string; phone: string; email?: string } = {
        name: `${lettersOnly(form.surname).trim()} ${lettersOnly(
          form.name
        ).trim()} ${lettersOnly(form.patronymic).trim()}`
          .replace(/\s+/g, ' ')
          .trim(),
        phone: normalizeUaPhone(form.phone),
      }
      if (emailClean) customer.email = emailClean

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer,
          shipping: {
            method: 'nova_poshta',
            np: {
              cityRef: co.np.cityRef,
              cityName: co.np.cityName,
              warehouseRef: co.np.warehouseRef,
              warehouseText: co.np.warehouseText,
            },
          },
          items,
          amountUAH: total,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError('Помилка створення замовлення')
        console.error(json)
        return
      }

      router.push(`/checkout/success?orderId=${json.orderId}`)

      // Payment LiqPay:
      const payRes = await fetch('/api/payments/liqpay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: json.orderId,
          amountUAH: total,
          description: `Замовлення #${json.orderId}`,
          customer: { name: form.name, email: form.email, phone: form.phone },
        }),
      })
      const payJson = await payRes.json()
      if (!payRes.ok) {
        setError('Помилка ініціалізації платежу')
        console.error(payJson)
        return
      }

      // Redirect to payment page
      router.push(
        `/checkout/pay?data=${encodeURIComponent(
          payJson.data
        )}&signature=${encodeURIComponent(
          payJson.signature
        )}&url=${encodeURIComponent(payJson.checkoutUrl)}`
      )
    } catch (e) {
      console.error(e)
      setError('Невідома помилка мережі')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="max-w-[1000px] mx-auto grid lg:grid-cols-[1fr_360px] gap-10 px-4 py-10">
      <div className="space-y-8">
        <h1 className="text-3xl font-fixel-display font-bold">
          Оформлення замовлення
        </h1>

        {/* Контакти */}
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">Імʼя</label>
            <input
              className={inputClass(isNameValid(form.name), touched.name)}
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: lettersOnly(e.target.value) })
              }
              onBlur={() => setTouched({ ...touched, name: true })}
              placeholder="Ваше імʼя"
            />
            {touched.name && !isNameValid(form.name) && (
              <p className="text-xs text-rose-600 mt-1">
                Введіть лише літери, мінімум 2 символи
              </p>
            )}
          </div>

          <div>
            <label className="text-sm text-gray-600">По батькові</label>
            <input
              className={inputClass(
                isNameValid(form.patronymic),
                touched.patronymic
              )}
              value={form.patronymic}
              onChange={(e) =>
                setForm({ ...form, patronymic: lettersOnly(e.target.value) })
              }
              onBlur={() => setTouched({ ...touched, patronymic: true })}
              placeholder="Ваше по батькові"
            />
            {touched.patronymic && !isNameValid(form.patronymic) && (
              <p className="text-xs text-rose-600 mt-1">
                Введіть лише літери, мінімум 2 символи
              </p>
            )}
          </div>
          <div>
            <label className="text-sm text-gray-600">Прізвище</label>
            <input
              className={inputClass(isNameValid(form.surname), touched.surname)}
              value={form.surname}
              onChange={(e) =>
                setForm({ ...form, surname: lettersOnly(e.target.value) })
              }
              onBlur={() => setTouched({ ...touched, surname: true })}
              placeholder="Ваше прізвище"
            />
            {touched.surname && !isNameValid(form.surname) && (
              <p className="text-xs text-rose-600 mt-1">
                Введіть лише літери, мінімум 2 символи
              </p>
            )}
          </div>
          <div>
            <label className="text-sm text-gray-600">Телефон</label>
            <input
              className={inputClass(
                isUaPhoneValid(normalizeUaPhone(form.phone)),
                touched.phone
              )}
              value={form.phone}
              onChange={(e) =>
                setForm({
                  ...form,
                  phone: e.target.value.replace(/\D/g, '').slice(0, 12),
                })
              }
              onBlur={() => setTouched({ ...touched, phone: true })}
              placeholder="формат 380XXXXXXXXX"
              inputMode="numeric"
            />
            {touched.phone && !isUaPhoneValid(normalizeUaPhone(form.phone)) && (
              <p className="text-xs text-rose-600 mt-1">
                Номер має містити 12 цифр і починатися з 380
              </p>
            )}
          </div>
          <div>
            <label className="text-sm text-gray-600">Email</label>
            <input
              className={inputClass(isEmailValid(form.email), touched.email)}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => setTouched({ ...touched, email: true })}
              placeholder="name@example.com"
            />
            {touched.email && !isEmailValid(form.email) && (
              <p className="text-xs text-rose-600 mt-1">
                Неправильно введено email
              </p>
            )}
          </div>
        </div>

        {/* Доставка НП */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Доставка</h2>
          <NovaPoshtaPicker />
        </div>

        {error && <p className="text-rose-600">{error}</p>}
      </div>

      {/* Правий сайдбар з підсумком */}
      <aside className="h-fit lg:sticky lg:top-16 border rounded p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span>Товарів</span>
          <span>{cart.items.reduce((n, i) => n + i.qty, 0)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>До сплати</span>
          <span className="font-semibold">
            {cart.items.reduce((s, i) => s + i.priceUAH * i.qty, 0)} грн
          </span>
        </div>

        <button
          onClick={submitOrder}
          disabled={loading}
          className="w-full h-12 rounded bg-black text-white hover:bg-[#FF3D8C] transition disabled:opacity-60 cursor-pointer"
        >
          {loading ? 'Створюємо замовлення…' : 'Підтвердити замовлення'}
        </button>
      </aside>
    </section>
  )
}
