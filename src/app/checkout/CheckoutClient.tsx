'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import NovaPoshtaPicker from '@/components/checkout/NovaPoshtaPicker'
import { useCart } from '../store/cart'
import { useCheckout } from '@/stores/checkout'
import { pushMetaInitiateCheckout } from '@/lib/analytics/datalayer'
import { IMaskInput } from 'react-imask'

export default function CheckoutClient() {
  const router = useRouter()
  const clearCart = useCart((s) => s.clear)

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
    'mt-3 w-full border-b pr-3 py-2 outline-none text-[12px] ' +
    (wasTouched
      ? ok
        ? 'border-emerald-500'
        : 'border-rose-500'
      : 'border-black')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      strapName: it.strapName ?? null,
    }))

    const subtotal = items.reduce((s, it) => s + it.priceUAH * it.qty, 0)
    const shipping = 0 // TODO: розрахунок тарифу
    const total = subtotal + shipping

    setLoading(true)
    try {
      const emailClean = form.email.trim()
      const customer: {
        name: string
        surname: string
        patronymic?: string
        phone: string
        email?: string
      } = {
        name: lettersOnly(form.name).trim(),
        surname: lettersOnly(form.surname).trim(),
        patronymic: form.patronymic
          ? lettersOnly(form.patronymic).trim()
          : undefined,
        phone: normalizeUaPhone(form.phone),
        email: form.email?.trim() || undefined,
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
              warehouseName: co.np.warehouseText,
            },
          },
          items,
          amountUAH: total,
          paymentMethod: co.paymentMethod,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError('Помилка створення замовлення')
        console.error(json)
        return
      }

      // Якщо обрана онлайн-оплата через WayForPay
      if (co.paymentMethod === 'WAYFORPAY') {
        try {
          const payRes = await fetch('/api/payments/wayforpay/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: json.orderId,
              amountUAH: total,
              description: `Замовлення #${json.orderNumber}`,
              customer: {
                email: customer.email,
                phone: customer.phone,
                firstName: customer.name,
                lastName: customer.surname,
              },
            }),
          })

          const payJson = await payRes.json()
          if (!payRes.ok) {
            console.error(payJson)
            setError('Помилка створення платежу')
            return
          }

          const { payUrl, payload } = payJson as {
            payUrl: string
            payload: Record<string, unknown>
          }

          // Створюємо форму і редіректимо користувача на WayForPay
          const form = document.createElement('form')
          form.method = 'POST'
          form.action = payUrl

          Object.entries(payload).forEach(([key, value]) => {
            if (value === undefined || value === null) return

            if (Array.isArray(value)) {
              value.forEach((v) => {
                const input = document.createElement('input')
                input.type = 'hidden'
                input.name = `${key}[]`
                input.value = String(v)
                form.appendChild(input)
              })
            } else {
              const input = document.createElement('input')
              input.type = 'hidden'
              input.name = key
              input.value = String(value)
              form.appendChild(input)
            }
          })

          document.body.appendChild(form)
          form.submit()
          return
        } catch (e) {
          console.error(e)
          setError('Помилка ініціалізації онлайн-оплати')
          return
        }
      }

      // Save last order snapshot for Meta Purchase (used on /success)
      try {
        sessionStorage.setItem(
          'gerdan_last_order_meta',
          JSON.stringify({
            value: total,
            numItems: items.reduce((s, i) => s + i.qty, 0),
            contentIds: items.map((i) => i.variantId || i.productId),
          })
        )
      } catch {}

      clearCart()
      router.push(`/checkout/success?order=${json.orderNumber}`)
      return
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
            <input
              className={inputClass(isNameValid(form.name), touched.name)}
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: lettersOnly(e.target.value) })
              }
              onBlur={() => setTouched({ ...touched, name: true })}
              placeholder="ІМʼЯ*"
            />
            {touched.name && !isNameValid(form.name) && (
              <p className="text-xs text-rose-600 mt-1">
                Введіть лише літери, мінімум 2 символи
              </p>
            )}
          </div>

          <div>
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
              placeholder="ПО БАТЬКОВІ*"
            />
            {touched.patronymic && !isNameValid(form.patronymic) && (
              <p className="text-xs text-rose-600 mt-1">
                Введіть лише літери, мінімум 2 символи
              </p>
            )}
          </div>
          <div>
            <input
              className={inputClass(isNameValid(form.surname), touched.surname)}
              value={form.surname}
              onChange={(e) =>
                setForm({ ...form, surname: lettersOnly(e.target.value) })
              }
              onBlur={() => setTouched({ ...touched, surname: true })}
              placeholder="ПРІЗВИЩЕ*"
            />
            {touched.surname && !isNameValid(form.surname) && (
              <p className="text-xs text-rose-600 mt-1">
                Введіть лише літери, мінімум 2 символи
              </p>
            )}
          </div>
          <div>
            <IMaskInput
              mask={'+{380} 00 000 00 00'}
              // keep value as a formatted string; we normalize to digits on submit
              value={form.phone}
              unmask={false}
              inputMode="tel"
              placeholder="+380 XX XXX XX XX"
              className={inputClass(
                isUaPhoneValid(normalizeUaPhone(form.phone)),
                touched.phone
              )}
              onAccept={(value) =>
                setForm({ ...form, phone: String(value ?? '') })
              }
              onBlur={() => setTouched({ ...touched, phone: true })}
            />
            {touched.phone && !isUaPhoneValid(normalizeUaPhone(form.phone)) && (
              <p className="text-xs text-rose-600 mt-1">
                Введіть номер у форматі +380 XX XXX XX XX
              </p>
            )}
          </div>
          <div>
            <input
              className={inputClass(isEmailValid(form.email), touched.email)}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => setTouched({ ...touched, email: true })}
              placeholder="EMAIL АДРЕСА*"
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

        {/* Оплата */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Оплата</h2>

          <div className="space-y-3 text-sm">
            {/* Оплата по реквізитам */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="radio"
                name="payment"
                className="mt-1 w-4 h-4"
                checked={co.paymentMethod === 'BANK_TRANSFER'}
                onChange={() => co.setPaymentMethod('BANK_TRANSFER')}
              />

              <div>
                <p className="font-medium uppercase">Оплата по реквізитам</p>
                <p className="text-gray-600">
                  Після створення замовлення ми надішлемо реквізити для оплати.
                </p>
              </div>
            </label>

            {/* Післяплата */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="payment"
                className="mt-1 w-4 h-4"
                checked={co.paymentMethod === 'COD'}
                onChange={() => co.setPaymentMethod('COD')}
              />
              <div>
                <p className="font-medium uppercase">Післяплата</p>
                <p className="text-gray-600">
                  Оплата при отриманні на відділенні Нової Пошти. Комісія НП: 2%
                  + 20 грн.
                </p>
              </div>
            </label>

            {/* Онлайн оплата WayForPay */}

            <label className="flex items-start gap-3 cursor-not-allowed opacity-40">
              <input
                type="radio"
                name="payment"
                disabled
                className="mt-1 w-4 h-4"
                checked={co.paymentMethod === 'WAYFORPAY'}
                onChange={() => co.setPaymentMethod('WAYFORPAY')}
              />
              <div>
                <p className="font-medium uppercase">Онлайн оплата карткою</p>
                <p className="text-gray-600">
                  Безпечна оплата банківською карткою через WayForPay.
                </p>
              </div>
            </label>
          </div>
        </div>

        {error && <p className="text-rose-600">{error}</p>}
      </div>

      {/* Правий сайдбар з підсумком */}
      <aside className="h-fit lg:sticky lg:top-16 border rounded p-5 space-y-4">
        {/* Перелік товарів у кошику */}
        <div className="space-y-3">
          {cart.items.map((item) => (
            <div
              key={`${item.productId}-${item.variantId ?? ''}`}
              className="flex items-center gap-3"
            >
              {item.image && (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-gray-100">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex flex-col text-sm">
                <span className="line-clamp-2">{item.name}</span>
                <span className="text-xs text-gray-500">
                  {item.qty} шт · {item.priceUAH} грн
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Підсумок */}
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
