import type { Locale } from './locale'

export type CheckoutCountry = {
  code: string
  nameUk: string
  nameEn: string
}

export const DEFAULT_CHECKOUT_COUNTRY_CODE = 'UA'

export const CHECKOUT_COUNTRIES: CheckoutCountry[] = [
  { code: 'UA', nameUk: 'Україна', nameEn: 'Ukraine' },
  { code: 'PL', nameUk: 'Польща', nameEn: 'Poland' },
  { code: 'DE', nameUk: 'Німеччина', nameEn: 'Germany' },
  { code: 'FR', nameUk: 'Франція', nameEn: 'France' },
  { code: 'IT', nameUk: 'Італія', nameEn: 'Italy' },
  { code: 'ES', nameUk: 'Іспанія', nameEn: 'Spain' },
  { code: 'NL', nameUk: 'Нідерланди', nameEn: 'Netherlands' },
  { code: 'BE', nameUk: 'Бельгія', nameEn: 'Belgium' },
  { code: 'AT', nameUk: 'Австрія', nameEn: 'Austria' },
  { code: 'CZ', nameUk: 'Чехія', nameEn: 'Czechia' },
  { code: 'SK', nameUk: 'Словаччина', nameEn: 'Slovakia' },
  { code: 'HU', nameUk: 'Угорщина', nameEn: 'Hungary' },
  { code: 'RO', nameUk: 'Румунія', nameEn: 'Romania' },
  { code: 'BG', nameUk: 'Болгарія', nameEn: 'Bulgaria' },
  { code: 'LT', nameUk: 'Литва', nameEn: 'Lithuania' },
  { code: 'LV', nameUk: 'Латвія', nameEn: 'Latvia' },
  { code: 'EE', nameUk: 'Естонія', nameEn: 'Estonia' },
  { code: 'PT', nameUk: 'Португалія', nameEn: 'Portugal' },
  { code: 'IE', nameUk: 'Ірландія', nameEn: 'Ireland' },
  { code: 'SE', nameUk: 'Швеція', nameEn: 'Sweden' },
  { code: 'DK', nameUk: 'Данія', nameEn: 'Denmark' },
  { code: 'FI', nameUk: 'Фінляндія', nameEn: 'Finland' },
  { code: 'NO', nameUk: 'Норвегія', nameEn: 'Norway' },
  { code: 'CH', nameUk: 'Швейцарія', nameEn: 'Switzerland' },
  { code: 'GB', nameUk: 'Велика Британія', nameEn: 'United Kingdom' },
  { code: 'US', nameUk: 'США', nameEn: 'United States' },
  { code: 'CA', nameUk: 'Канада', nameEn: 'Canada' },
  { code: 'AU', nameUk: 'Австралія', nameEn: 'Australia' },
]

export function getCheckoutCountryByCode(code: string | null | undefined) {
  const normalized = String(code ?? '').trim().toUpperCase()
  return (
    CHECKOUT_COUNTRIES.find((country) => country.code === normalized) ??
    CHECKOUT_COUNTRIES[0]
  )
}

export function getCheckoutCountryLabel(
  country: CheckoutCountry,
  locale: Locale,
) {
  return locale === 'en' ? country.nameEn : country.nameUk
}

export function getCheckoutCountryOpsLabel(code: string | null | undefined) {
  const normalized = String(code ?? '').trim().toUpperCase()
  const country = CHECKOUT_COUNTRIES.find(
    (item) => item.code === normalized,
  )
  return country?.nameUk ?? normalized
}
