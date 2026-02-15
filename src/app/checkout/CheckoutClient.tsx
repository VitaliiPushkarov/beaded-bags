'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import NovaPoshtaPicker from '@/components/checkout/NovaPoshtaPicker'
import { useCart } from '../store/cart'
import { useCheckout } from '@/stores/checkout'
import { IMaskInput } from 'react-imask'

import { usePromo } from '@/lib/usePromo'
import { isPromoApplied, calcDiscountUAH, PROMO_CODE } from '@/lib/promo'

type CheckoutFormState = {
  name: string
  surname: string
  patronymic: string
  phone: string
  email: string
}

const CHECKOUT_FORM_DRAFT_KEY = 'gerdan_checkout_form_draft'

function emptyCheckoutForm(): CheckoutFormState {
  return {
    name: '',
    surname: '',
    patronymic: '',
    phone: '',
    email: '',
  }
}

function loadCheckoutFormDraft(): CheckoutFormState {
  if (typeof window === 'undefined') return emptyCheckoutForm()
  try {
    const raw = sessionStorage.getItem(CHECKOUT_FORM_DRAFT_KEY)
    if (!raw) return emptyCheckoutForm()
    const parsed = JSON.parse(raw) as Partial<CheckoutFormState>
    return {
      name: String(parsed.name ?? ''),
      surname: String(parsed.surname ?? ''),
      patronymic: String(parsed.patronymic ?? ''),
      phone: String(parsed.phone ?? ''),
      email: String(parsed.email ?? ''),
    }
  } catch {
    return emptyCheckoutForm()
  }
}

function saveCheckoutFormDraft(form: CheckoutFormState) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(CHECKOUT_FORM_DRAFT_KEY, JSON.stringify(form))
  } catch {}
}

function clearCheckoutFormDraft() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(CHECKOUT_FORM_DRAFT_KEY)
  } catch {}
}

export default function CheckoutClient() {
  const router = useRouter()
  const sp = useSearchParams()
  const paymentResult = sp.get('payment')
  const clearCart = useCart((s) => s.clear)

  const [form, setForm] = useState<CheckoutFormState>(() =>
    loadCheckoutFormDraft(),
  )

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

  useEffect(() => {
    saveCheckoutFormDraft(form)
  }, [form])

  useEffect(() => {
    if (paymentResult === 'cancelled') {
      setError('Оплату скасовано. Дані клієнта збережено, спробуйте ще раз.')
      return
    }
    if (paymentResult === 'failed') {
      setError('Оплата не пройшла. Дані клієнта збережено, спробуйте ще раз.')
    }
  }, [paymentResult])

  const cart = useCart()
  const co = useCheckout()

  const promo = usePromo()
  const promoOn = isPromoApplied(promo)

  const subtotalUAH = useMemo(
    () => cart.items.reduce((s, i) => s + i.priceUAH * i.qty, 0),
    [cart.items],
  )

  const discountUAH = useMemo(
    () => calcDiscountUAH(subtotalUAH, promoOn),
    [subtotalUAH, promoOn],
  )

  const finalTotalUAH = useMemo(
    () => Math.max(0, subtotalUAH - discountUAH),
    [subtotalUAH, discountUAH],
  )

  const saveLastOrderMeta = (
    total: number,
    checkoutItems: Array<{
      productId?: string | null
      variantId?: string | null
      qty: number
    }>,
  ) => {
    try {
      sessionStorage.setItem(
        'gerdan_last_order_meta',
        JSON.stringify({
          value: total,
          numItems: checkoutItems.reduce((s, i) => s + i.qty, 0),
          contentIds: checkoutItems
            .map((i) => i.variantId || i.productId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        }),
      )
    } catch {}
  }

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
      addons: it.addons ?? [],
    }))

    const subtotal = items.reduce((s, it) => s + it.priceUAH * it.qty, 0)
    const shipping = 0 // TODO: розрахунок тарифу

    const discountUAH = calcDiscountUAH(subtotal, promoOn)
    const total = Math.max(0, subtotal - discountUAH) + shipping

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
          promoCode: promoOn ? PROMO_CODE : null,
          paymentMethod: co.paymentMethod,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError('Помилка створення замовлення')
        console.error(json)
        return
      }

      if (co.paymentMethod === 'LIQPAY') {
        try {
          const payRes = await fetch('/api/payments/liqpay/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: json.orderId,
            }),
          })

          const payJson = await payRes.json()
          if (!payRes.ok) {
            console.error(payJson)
            setError('Помилка створення платежу')
            return
          }

          const { checkoutUrl, data, signature } = payJson as {
            checkoutUrl: string
            data: string
            signature: string
          }

          if (!checkoutUrl || !data || !signature) {
            setError('Неповні дані платежу від сервера')
            return
          }

          saveLastOrderMeta(total, items)

          const payForm = document.createElement('form')
          payForm.method = 'POST'
          payForm.action = checkoutUrl

          const dataInput = document.createElement('input')
          dataInput.type = 'hidden'
          dataInput.name = 'data'
          dataInput.value = data
          payForm.appendChild(dataInput)

          const signatureInput = document.createElement('input')
          signatureInput.type = 'hidden'
          signatureInput.name = 'signature'
          signatureInput.value = signature
          payForm.appendChild(signatureInput)

          document.body.appendChild(payForm)
          payForm.submit()
          return
        } catch (e) {
          console.error(e)
          setError('Помилка ініціалізації онлайн-оплати')
          return
        }
      }

      // Save last order snapshot for Meta Purchase (used on /success)
      saveLastOrderMeta(total, items)

      clearCart()
      clearCheckoutFormDraft()
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
        <h1 className="text-2xl mb-1 md:text-3xl font-fixel-display font-bold">
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
                touched.patronymic,
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
                touched.phone,
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
            {/* Онлайн оплата LiqPay */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="payment"
                className="mt-1 w-4 h-4"
                checked={co.paymentMethod === 'LIQPAY'}
                onChange={() => co.setPaymentMethod('LIQPAY')}
              />
              <div>
                <p className="font-medium uppercase">
                  Онлайн оплата (LiqPay)
                </p>
                <p className="text-gray-600">
                  Картка, Apple Pay або Google Pay на сторінці LiqPay checkout.
                </p>
              </div>
            </label>

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
          <span>Вартість</span>
          <span className="font-semibold">{subtotalUAH} грн</span>
        </div>

        {discountUAH > 0 && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Знижка (промокод)</span>
            <span>- {discountUAH} грн</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span>До сплати</span>
          <span className="font-semibold">{finalTotalUAH} грн</span>
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
