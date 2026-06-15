'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import NovaPoshtaPicker from '@/components/checkout/NovaPoshtaPicker'
import {
  CHECKOUT_COUNTRIES,
  DEFAULT_CHECKOUT_COUNTRY_CODE,
  getCheckoutCountryByCode,
  getCheckoutCountryLabel,
} from '@/lib/checkout-countries'
import { useCart } from '../store/cart'
import { useCheckout } from '@/stores/checkout'
import { IMaskInput } from 'react-imask'

import { usePromo } from '@/lib/usePromo'
import { calcDiscountUAH, getPromoDiscountPct, resolvePromoCode } from '@/lib/promo'
import { useLocale, useLocaleNumberFormat, useT } from '@/lib/i18n'
import { buildCheckoutAttemptFingerprint } from '@/lib/orders/checkout-attempt'
import {
  isOnlinePaymentAvailableForShippingMethod,
  resolveCheckoutPaymentMethod,
} from '@/lib/orders/payment-methods'
import {
  getCartItemUnitPrice,
  resolveCartDisplayCurrency,
  sumCartDisplayAmount,
} from '@/lib/cart-money'
import { formatLocalizedMoney } from '@/lib/localized-product'

type CheckoutFormState = {
  name: string
  surname: string
  phone: string
  email: string
}

const CHECKOUT_FORM_DRAFT_KEY = 'gerdan_checkout_form_draft'
const CHECKOUT_ATTEMPT_META_KEY = 'gerdan_checkout_attempt_meta'

function emptyCheckoutForm(): CheckoutFormState {
  return {
    name: '',
    surname: '',
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

function createCheckoutAttemptKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getOrCreateCheckoutAttemptKey(fingerprint: string) {
  if (typeof window === 'undefined') return createCheckoutAttemptKey()

  try {
    const raw = sessionStorage.getItem(CHECKOUT_ATTEMPT_META_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { key?: string; fingerprint?: string }
      if (
        typeof parsed.key === 'string' &&
        parsed.key &&
        parsed.fingerprint === fingerprint
      ) {
        return parsed.key
      }
    }
  } catch {}

  const key = createCheckoutAttemptKey()

  try {
    sessionStorage.setItem(
      CHECKOUT_ATTEMPT_META_KEY,
      JSON.stringify({ key, fingerprint }),
    )
  } catch {}

  return key
}

function clearCheckoutAttemptKey() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(CHECKOUT_ATTEMPT_META_KEY)
  } catch {}
}

export default function CheckoutClient() {
  const locale = useLocale()
  const numberLocale = useLocaleNumberFormat()
  const t = useT()
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
    phone: false,
    email: false,
    intlCity: false,
    intlPostalCode: false,
    intlAddressLine1: false,
  })

  const lettersOnly = (s: string) =>
    s.replace(/[^\p{L}\p{M}' -]/gu, '')

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

  const normalizeIntlPhone = (s: string) => {
    const value = String(s ?? '').trim()
    if (!value) return ''
    if (value.startsWith('+')) {
      return `+${value.slice(1).replace(/\D/g, '')}`
    }
    return value.replace(/\D/g, '')
  }

  const isNameValid = (s: string) => lettersOnly(s).trim().length >= 2
  const isEmailValid = (s: string) => !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
  const isUaPhoneValid = (d: string) =>
    /^\d{12}$/.test(d) && d.startsWith('380')
  const isIntlPhoneValid = (s: string) => /^\+[1-9]\d{6,14}$/.test(s)

  const inputClass = (ok: boolean, wasTouched: boolean) =>
    'mt-3 w-full border-b pr-3 py-2 outline-none text-[14px] ' +
    (wasTouched
      ? ok
        ? 'border-emerald-500'
        : 'border-rose-500'
      : 'border-black')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitLockRef = useRef(false)

  useEffect(() => {
    saveCheckoutFormDraft(form)
  }, [form])

  useEffect(() => {
    if (paymentResult === 'cancelled') {
      clearCheckoutAttemptKey()
      setError(
        t(
          'Оплату скасовано. Дані клієнта збережено, спробуйте ще раз.',
          'Payment cancelled. Customer data is saved, please try again.',
        ),
      )
      return
    }
    if (paymentResult === 'failed') {
      clearCheckoutAttemptKey()
      setError(
        t(
          'Оплата не пройшла. Дані клієнта збережено, спробуйте ще раз.',
          'Payment failed. Customer data is saved, please try again.',
        ),
      )
    }
  }, [paymentResult, t])

  const cart = useCart()
  const co = useCheckout()

  const promo = usePromo()
  const appliedPromoCode = resolvePromoCode(promo)
  const selectedCountry = useMemo(
    () => getCheckoutCountryByCode(co.shippingCountryCode),
    [co.shippingCountryCode],
  )
  const isUkraineShipping =
    selectedCountry.code === DEFAULT_CHECKOUT_COUNTRY_CODE
  const shippingMethod = isUkraineShipping
    ? 'nova_poshta'
    : 'international_address'
  const onlinePaymentAvailable = isOnlinePaymentAvailableForShippingMethod(
    shippingMethod,
  )
  const selectedPaymentMethod = resolveCheckoutPaymentMethod(
    co.paymentMethod,
    shippingMethod,
  )

  useEffect(() => {
    if (!onlinePaymentAvailable && co.paymentMethod !== 'BANK_TRANSFER') {
      co.setPaymentMethod('BANK_TRANSFER')
    }
  }, [co, onlinePaymentAvailable])

  const subtotalUAH = useMemo(
    () => cart.items.reduce((s, i) => s + i.priceUAH * i.qty, 0),
    [cart.items],
  )

  const discountUAH = useMemo(
    () => calcDiscountUAH(subtotalUAH, appliedPromoCode),
    [subtotalUAH, appliedPromoCode],
  )

  const discountPct = useMemo(
    () => getPromoDiscountPct(appliedPromoCode),
    [appliedPromoCode],
  )

  const finalTotalUAH = useMemo(
    () => Math.max(0, subtotalUAH - discountUAH),
    [subtotalUAH, discountUAH],
  )

  const checkoutDisplayCurrency = useMemo(
    () =>
      resolveCartDisplayCurrency({
        items: cart.items,
        preferredCurrency: isUkraineShipping ? 'UAH' : 'USD',
      }),
    [cart.items, isUkraineShipping],
  )

  const subtotalDisplay = useMemo(
    () => sumCartDisplayAmount(cart.items, checkoutDisplayCurrency),
    [cart.items, checkoutDisplayCurrency],
  )

  const discountDisplay = useMemo(() => {
    if (!discountPct) return 0
    return Math.round((subtotalDisplay * discountPct) / 100)
  }, [discountPct, subtotalDisplay])

  const finalTotalDisplay = useMemo(
    () => Math.max(0, subtotalDisplay - discountDisplay),
    [subtotalDisplay, discountDisplay],
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
            .filter(
              (id): id is string => typeof id === 'string' && id.length > 0,
            ),
        }),
      )
    } catch {}
  }

  const submitOrder = async () => {
    if (submitLockRef.current || loading) return

    submitLockRef.current = true
    setError(null)
    const fioValid = isNameValid(form.name) && isNameValid(form.surname)
    const phoneNorm = isUkraineShipping
      ? normalizeUaPhone(form.phone)
      : normalizeIntlPhone(form.phone)
    const phoneValid = isUkraineShipping
      ? isUaPhoneValid(phoneNorm)
      : isIntlPhoneValid(phoneNorm)
    const emailValid = isEmailValid(form.email)
    const intlCity = String(co.intl.city ?? '').trim()
    const intlRegion = String(co.intl.region ?? '').trim()
    const intlPostalCode = String(co.intl.postalCode ?? '').trim()
    const intlAddressLine1 = String(co.intl.addressLine1 ?? '').trim()
    const intlAddressLine2 = String(co.intl.addressLine2 ?? '').trim()

    if (!fioValid || !phoneValid || !emailValid) {
      setTouched({
        name: true,
        surname: true,
        phone: true,
        email: true,
        intlCity: true,
        intlPostalCode: true,
        intlAddressLine1: true,
      })
      setError(
        t('Перевірте правильність полів форми', 'Please check form fields'),
      )
      return
    }
    if (isUkraineShipping) {
      if (
        !co.np.cityRef ||
        !co.np.cityName ||
        !co.np.warehouseRef ||
        !co.np.warehouseText
      ) {
        setError(
          t(
            'Оберіть місто та відділення Нової Пошти',
            'Select city and Nova Poshta branch',
          ),
        )
        return
      }
    } else if (!intlCity || !intlPostalCode || !intlAddressLine1) {
      setTouched((prev) => ({
        ...prev,
        intlCity: true,
        intlPostalCode: true,
        intlAddressLine1: true,
      }))
      setError(
        t(
          'Заповніть міжнародну адресу доставки',
          'Fill in the international shipping address',
        ),
      )
      return
    }
    if (cart.items.length === 0) {
      setError(t('Кошик порожній', 'Cart is empty'))
      return
    }

    const items = cart.items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId,
      strapId: it.strapId ?? null,
      sizeId: it.sizeId ?? null,
      pouchId: it.pouchId ?? null,
      name: it.name,
      color: it.color ?? null,
      modelSize: it.modelSize ?? null,
      pouchColor: it.pouchColor ?? null,
      image: it.image,
      priceUAH: it.priceUAH,
      qty: it.qty,
      strapName: it.strapName ?? null,
      addons: it.addons ?? [],
    }))

    const subtotal = items.reduce((s, it) => s + it.priceUAH * it.qty, 0)
    const shipping = 0 // TODO: розрахунок тарифу

    const discountUAH = calcDiscountUAH(subtotal, appliedPromoCode)
    const total = Math.max(0, subtotal - discountUAH) + shipping
    const fingerprint = buildCheckoutAttemptFingerprint({
      items,
      amountUAH: total,
      paymentMethod: selectedPaymentMethod,
      customerPhone: phoneNorm,
      shippingMethod,
      cityRef: isUkraineShipping ? co.np.cityRef : undefined,
      warehouseRef: isUkraineShipping ? co.np.warehouseRef : undefined,
      shippingCountryCode: selectedCountry.code,
      shippingCity: isUkraineShipping ? undefined : intlCity,
      shippingRegion: isUkraineShipping ? undefined : intlRegion,
      shippingPostalCode: isUkraineShipping ? undefined : intlPostalCode,
      shippingAddressLine1: isUkraineShipping ? undefined : intlAddressLine1,
      shippingAddressLine2: isUkraineShipping ? undefined : intlAddressLine2,
      promoCode: appliedPromoCode,
    })
    const idempotencyKey = getOrCreateCheckoutAttemptKey(fingerprint)

    setLoading(true)
    try {
      const emailClean = form.email.trim()
      const customer: {
        name: string
        surname: string
        phone: string
        email?: string
      } = {
        name: lettersOnly(form.name).trim(),
        surname: lettersOnly(form.surname).trim(),
        phone: phoneNorm,
        email: form.email?.trim() || undefined,
      }
      if (emailClean) customer.email = emailClean

      const shippingPayload = isUkraineShipping
        ? {
            method: 'nova_poshta' as const,
            np: {
              cityRef: co.np.cityRef!,
              cityName: co.np.cityName!,
              warehouseRef: co.np.warehouseRef!,
              warehouseName: co.np.warehouseText!,
            },
          }
        : {
            method: 'international_address' as const,
            address: {
              countryCode: selectedCountry.code,
              countryName: selectedCountry.nameEn,
              city: intlCity,
              region: intlRegion || undefined,
              postalCode: intlPostalCode,
              addressLine1: intlAddressLine1,
              addressLine2: intlAddressLine2 || undefined,
            },
          }

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer,
          shipping: shippingPayload,
          items,
          amountUAH: total,
          promoCode: appliedPromoCode,
          idempotencyKey,
          paymentMethod: selectedPaymentMethod,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(t('Помилка створення замовлення', 'Failed to create order'))
        console.error(json)
        return
      }

      if (selectedPaymentMethod === 'LIQPAY') {
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
            setError(t('Помилка створення платежу', 'Failed to create payment'))
            return
          }

          const { checkoutUrl, data, signature } = payJson as {
            checkoutUrl: string
            data: string
            signature: string
          }

          if (!checkoutUrl || !data || !signature) {
            setError(
              t(
                'Неповні дані платежу від сервера',
                'Incomplete payment data from server',
              ),
            )
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
          setError(
            t(
              'Помилка ініціалізації онлайн-оплати',
              'Online payment initialization failed',
            ),
          )
          return
        }
      }

      // Save last order snapshot for Meta Purchase (used on /success)
      saveLastOrderMeta(total, items)

      clearCart()
      clearCheckoutFormDraft()
      clearCheckoutAttemptKey()
      router.push(`/checkout/success?order=${json.orderNumber}`)
      return
    } catch (e) {
      console.error(e)
      setError(t('Невідома помилка мережі', 'Unknown network error'))
    } finally {
      submitLockRef.current = false
      setLoading(false)
    }
  }

  return (
    <section className="max-w-[1280px] mx-auto grid lg:grid-cols-[1fr_360px] gap-20 px-4 py-10 2xl:max-w-[1440px] 2xl:grid-cols-2">
      <div className="space-y-8">
        <h1 className="text-xl mb-1 md:text-3xl font-fixel-display font-semibold">
          {t('Оформлення замовлення', 'Checkout')}
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
              placeholder={t('ІМʼЯ*', 'FIRST NAME*')}
            />
            {touched.name && !isNameValid(form.name) && (
              <p className="text-xs text-rose-600 mt-1">
                {t(
                  'Введіть лише літери, мінімум 2 символи',
                  'Use letters only, at least 2 characters',
                )}
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
              placeholder={t('ПРІЗВИЩЕ*', 'LAST NAME*')}
            />
            {touched.surname && !isNameValid(form.surname) && (
              <p className="text-xs text-rose-600 mt-1">
                {t(
                  'Введіть лише літери, мінімум 2 символи',
                  'Use letters only, at least 2 characters',
                )}
              </p>
            )}
          </div>
          <div>
            {isUkraineShipping ? (
              <>
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
                {touched.phone &&
                  !isUaPhoneValid(normalizeUaPhone(form.phone)) && (
                    <p className="text-xs text-rose-600 mt-1">
                      {t(
                        'Введіть номер у форматі +380 XX XXX XX XX',
                        'Enter phone number in +380 XX XXX XX XX format',
                      )}
                    </p>
                  )}
              </>
            ) : (
              <>
                <input
                  className={inputClass(
                    isIntlPhoneValid(normalizeIntlPhone(form.phone)),
                    touched.phone,
                  )}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  onBlur={() => setTouched({ ...touched, phone: true })}
                  inputMode="tel"
                  placeholder="+48 123 456 789"
                />
                {touched.phone &&
                  !isIntlPhoneValid(normalizeIntlPhone(form.phone)) && (
                    <p className="text-xs text-rose-600 mt-1">
                      {t(
                        'Введіть номер у міжнародному форматі, наприклад +48 123 456 789',
                        'Enter phone in international format, for example +48 123 456 789',
                      )}
                    </p>
                  )}
              </>
            )}
          </div>
          <div>
            <input
              className={inputClass(isEmailValid(form.email), touched.email)}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => setTouched({ ...touched, email: true })}
              placeholder={t('EMAIL АДРЕСА*', 'EMAIL ADDRESS*')}
            />
            {touched.email && !isEmailValid(form.email) && (
              <p className="text-xs text-rose-600 mt-1">
                {t('Неправильно введено email', 'Invalid email format')}
              </p>
            )}
          </div>
        </div>

        {/* Доставка */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{t('Доставка', 'Shipping')}</h2>
          <div>
            <label className="text-xs text-gray-500">
              {t('Країна доставки*', 'Shipping country*')}
            </label>
            <select
              className="mt-3 w-full border-b pr-3 py-2 outline-none text-[14px] border-black bg-transparent"
              value={selectedCountry.code}
              onChange={(e) => co.setShippingCountry(e.target.value)}
            >
              {CHECKOUT_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {getCheckoutCountryLabel(country, locale)}
                </option>
              ))}
            </select>
          </div>

          {isUkraineShipping ? (
            <NovaPoshtaPicker />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <input
                  className={inputClass(
                    Boolean(String(co.intl.city ?? '').trim()),
                    touched.intlCity,
                  )}
                  value={co.intl.city ?? ''}
                  onChange={(e) =>
                    co.setInternational({ city: e.target.value })
                  }
                  onBlur={() => setTouched({ ...touched, intlCity: true })}
                  placeholder={t('МІСТО*', 'CITY*')}
                />
                {touched.intlCity && !String(co.intl.city ?? '').trim() && (
                  <p className="text-xs text-rose-600 mt-1">
                    {t('Вкажіть місто доставки', 'Enter shipping city')}
                  </p>
                )}
              </div>

              <div>
                <input
                  className={inputClass(
                    Boolean(String(co.intl.postalCode ?? '').trim()),
                    touched.intlPostalCode,
                  )}
                  value={co.intl.postalCode ?? ''}
                  onChange={(e) =>
                    co.setInternational({ postalCode: e.target.value })
                  }
                  onBlur={() =>
                    setTouched({ ...touched, intlPostalCode: true })
                  }
                  placeholder={t('ПОШТОВИЙ ІНДЕКС*', 'POSTAL CODE*')}
                />
                {touched.intlPostalCode &&
                  !String(co.intl.postalCode ?? '').trim() && (
                    <p className="text-xs text-rose-600 mt-1">
                      {t('Вкажіть поштовий індекс', 'Enter postal code')}
                    </p>
                  )}
              </div>

              <div className="md:col-span-2">
                <input
                  className={inputClass(
                    Boolean(String(co.intl.addressLine1 ?? '').trim()),
                    touched.intlAddressLine1,
                  )}
                  value={co.intl.addressLine1 ?? ''}
                  onChange={(e) =>
                    co.setInternational({ addressLine1: e.target.value })
                  }
                  onBlur={() =>
                    setTouched({ ...touched, intlAddressLine1: true })
                  }
                  placeholder={t('АДРЕСА*', 'ADDRESS LINE 1*')}
                />
                {touched.intlAddressLine1 &&
                  !String(co.intl.addressLine1 ?? '').trim() && (
                    <p className="text-xs text-rose-600 mt-1">
                      {t(
                        'Вкажіть адресу доставки',
                        'Enter shipping address',
                      )}
                    </p>
                  )}
              </div>

              <div className="md:col-span-2">
                <input
                  className="mt-3 w-full border-b pr-3 py-2 outline-none text-[14px] border-black"
                  value={co.intl.addressLine2 ?? ''}
                  onChange={(e) =>
                    co.setInternational({ addressLine2: e.target.value })
                  }
                  placeholder={t(
                    'КВАРТИРА, ОФІС, ПОВЕРХ',
                    'ADDRESS LINE 2',
                  )}
                />
              </div>

              <div className="md:col-span-2">
                <input
                  className="mt-3 w-full border-b pr-3 py-2 outline-none text-[14px] border-black"
                  value={co.intl.region ?? ''}
                  onChange={(e) =>
                    co.setInternational({ region: e.target.value })
                  }
                  placeholder={t('ОБЛАСТЬ / ШТАТ', 'REGION / STATE')}
                />
              </div>
            </div>
          )}
        </div>

        {/* Оплата */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{t('Оплата', 'Payment')}</h2>

          <div className="space-y-3 text-sm">
            {/* Онлайн оплата LiqPay */}
            <label className="flex items-start gap-3 cursor-pointer">
              {onlinePaymentAvailable ? (
                <>
                  <input
                    type="radio"
                    name="payment"
                    className="mt-1 w-4 h-4"
                    checked={selectedPaymentMethod === 'LIQPAY'}
                    onChange={() => co.setPaymentMethod('LIQPAY')}
                  />
                  <div>
                    <p className="font-medium uppercase">
                      {t('Онлайн оплата (LiqPay)', 'Online payment (LiqPay)')}
                    </p>
                    <p className="text-gray-600">
                      {t(
                        'Картка, Apple Pay або Google Pay на сторінці LiqPay checkout.',
                        'Card, Apple Pay or Google Pay on LiqPay checkout page.',
                      )}
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-gray-700">
                  <p className="font-medium">
                    {t(
                      'Онлайн-оплата для міжнародних замовлень тимчасово недоступна.',
                      'Online payment is currently unavailable for international orders.',
                    )}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {t(
                      'Для доставки за кордон зараз доступна оплата по реквізитах.',
                      'Bank transfer is currently available for international delivery.',
                    )}
                  </p>
                </div>
              )}
            </label>

            {/* Оплата по реквізитам */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="radio"
                name="payment"
                className="mt-1 w-4 h-4"
                checked={selectedPaymentMethod === 'BANK_TRANSFER'}
                onChange={() => co.setPaymentMethod('BANK_TRANSFER')}
              />

              <div>
                <p className="font-medium uppercase">
                  {t('Оплата по реквізитам', 'Bank transfer')}
                </p>
                <p className="text-gray-600">
                  {t(
                    `Після створення замовлення ми надішлемо реквізити для оплати в ${
                      checkoutDisplayCurrency === 'USD' ? 'USD' : 'грн'
                    }.`,
                    `We will send payment details in ${
                      checkoutDisplayCurrency === 'USD' ? 'USD' : 'UAH'
                    } after the order is created.`,
                  )}
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
              key={`${item.productId}-${item.variantId ?? ''}-${item.strapId ?? ''}-${item.sizeId ?? ''}-${item.pouchId ?? ''}`}
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
                {item.color && (
                  <span className="text-xs text-gray-500">
                    {t('Колір', 'Color')}: {item.color}
                  </span>
                )}
                {item.modelSize && (
                  <span className="text-xs text-gray-500">
                    {t('Розмір моделі', 'Size')}: {item.modelSize}
                  </span>
                )}
                {item.pouchColor && (
                  <span className="text-xs text-gray-500">
                    {t('Мішечок', 'Pouch')}: {item.pouchColor}
                  </span>
                )}
                {item.strapName && (
                  <span className="text-xs text-gray-500">
                    {t('Ремінець', 'Strap')}: {item.strapName}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {item.qty} {t('шт', 'pcs')} ·{' '}
                  {formatLocalizedMoney(
                    getCartItemUnitPrice(item, checkoutDisplayCurrency),
                    checkoutDisplayCurrency,
                    numberLocale,
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Підсумок */}
        <div className="flex items-center justify-between">
          <span>{t('Товарів', 'Items')}</span>
          <span>{cart.items.reduce((n, i) => n + i.qty, 0)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>{t('Вартість', 'Subtotal')}</span>
          <span className="font-semibold">
            {formatLocalizedMoney(
              subtotalDisplay,
              checkoutDisplayCurrency,
              numberLocale,
            )}
          </span>
        </div>

        {discountDisplay > 0 && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{t('Знижка (промокод)', 'Discount (promo code)')}</span>
            <span>
              -{' '}
              {formatLocalizedMoney(
                discountDisplay,
                checkoutDisplayCurrency,
                numberLocale,
              )}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span>{t('До сплати', 'Total')}</span>
          <span className="font-semibold">
            {formatLocalizedMoney(
              finalTotalDisplay,
              checkoutDisplayCurrency,
              numberLocale,
            )}
          </span>
        </div>

        <button
          onClick={submitOrder}
          disabled={loading}
          className="w-full h-12 rounded bg-black text-white hover:bg-[#FF3D8C] transition disabled:opacity-60 cursor-pointer"
        >
          {loading
            ? t('Створюємо замовлення…', 'Creating order...')
            : t('Підтвердити замовлення', 'Confirm order')}
        </button>
      </aside>
    </section>
  )
}
