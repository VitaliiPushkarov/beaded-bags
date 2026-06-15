import { getCheckoutCountryOpsLabel } from '@/lib/checkout-countries'

type OrderShippingLike = {
  shippingMethod?: string | null
  shippingCountryCode?: string | null
  shippingCountryName?: string | null
  shippingRegion?: string | null
  shippingCity?: string | null
  shippingPostalCode?: string | null
  shippingAddressLine1?: string | null
  shippingAddressLine2?: string | null
  npCityName?: string | null
  npWarehouseName?: string | null
}

export type OrderShippingField = {
  label: string
  value: string
}

function clean(value: string | null | undefined) {
  return String(value ?? '').trim()
}

function isInternationalShipping(order: OrderShippingLike) {
  return clean(order.shippingMethod) === 'INTERNATIONAL_ADDRESS'
}

function buildNovaPoshtaSummary(order: OrderShippingLike) {
  const cityName = clean(order.npCityName)
  const warehouseName = clean(order.npWarehouseName)
  const showWarehouse =
    warehouseName.length > 0 &&
    warehouseName.toUpperCase() !== 'НЕ ВКАЗАНО' &&
    cityName !== 'Ручне замовлення'

  const parts = [
    cityName,
    showWarehouse ? `Відділення: ${warehouseName}` : '',
  ].filter((part) => part.length > 0)

  const fields: OrderShippingField[] = []
  if (cityName) fields.push({ label: 'Місто', value: cityName })
  if (showWarehouse) {
    fields.push({ label: 'Відділення', value: warehouseName })
  }

  return {
    methodLabel: 'Нова пошта',
    summary: parts.join(', ') || '—',
    fields,
  }
}

function buildInternationalSummary(order: OrderShippingLike) {
  const countryCode = clean(order.shippingCountryCode)
  const countryName =
    countryCode.length > 0
      ? getCheckoutCountryOpsLabel(countryCode)
      : clean(order.shippingCountryName)
  const region = clean(order.shippingRegion)
  const city = clean(order.shippingCity)
  const postalCode = clean(order.shippingPostalCode)
  const addressLine1 = clean(order.shippingAddressLine1)
  const addressLine2 = clean(order.shippingAddressLine2)
  const locality = [postalCode, city].filter((part) => part.length > 0).join(' ')

  const summaryParts = [
    countryName || clean(order.shippingCountryName) || countryCode,
    region,
    locality,
    addressLine1,
    addressLine2,
  ].filter((part) => part.length > 0)

  const fields: OrderShippingField[] = []
  if (countryName || clean(order.shippingCountryName) || countryCode) {
    fields.push({
      label: 'Країна',
      value: countryName || clean(order.shippingCountryName) || countryCode,
    })
  }
  if (region) fields.push({ label: 'Регіон / штат', value: region })
  if (locality) fields.push({ label: 'Місто / індекс', value: locality })
  if (addressLine1) fields.push({ label: 'Адреса', value: addressLine1 })
  if (addressLine2) fields.push({ label: 'Адреса 2', value: addressLine2 })

  return {
    methodLabel: 'Міжнародна доставка',
    summary: summaryParts.join(', ') || '—',
    fields,
  }
}

export function getOrderShippingDetails(order: OrderShippingLike) {
  if (isInternationalShipping(order)) {
    return buildInternationalSummary(order)
  }

  return buildNovaPoshtaSummary(order)
}
