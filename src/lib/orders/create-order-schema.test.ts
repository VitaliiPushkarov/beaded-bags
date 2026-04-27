import test from 'node:test'
import assert from 'node:assert/strict'

import { OrderCreateCheckoutBodySchema } from './create-order-schema'

type CheckoutPayloadFixture = {
  customer: {
    name: string
    surname: string
    patronymic?: string
    phone: string
    email: string
  }
  shipping: {
    method: 'nova_poshta'
    np: {
      cityRef: string
      cityName: string
      warehouseRef: string
      warehouseName: string
    }
  }
  items: Array<{
    productId: string
    variantId: string
    name: string
    qty: number
    priceUAH: number
    color: string
    image: string
    addons: unknown[]
  }>
  amountUAH: number
  paymentMethod: 'LIQPAY'
}

function buildValidCheckoutPayload() {
  const payload: CheckoutPayloadFixture = {
    customer: {
      name: 'Марія',
      surname: 'Іваненко',
      phone: '380501112233',
      email: 'maria@example.com',
    },
    shipping: {
      method: 'nova_poshta' as const,
      np: {
        cityRef: 'city-ref',
        cityName: 'Київ',
        warehouseRef: 'warehouse-ref',
        warehouseName: 'Відділення 1',
      },
    },
    items: [
      {
        productId: 'product-1',
        variantId: 'variant-1',
        name: 'Classic Mini',
        qty: 1,
        priceUAH: 2500,
        color: 'red',
        image: 'https://example.com/image.jpg',
        addons: [],
      },
    ],
    amountUAH: 2500,
    paymentMethod: 'LIQPAY',
  }
  return payload
}

test('OrderCreateCheckoutBodySchema accepts checkout payload without patronymic', () => {
  const parsed = OrderCreateCheckoutBodySchema.safeParse(buildValidCheckoutPayload())
  assert.equal(parsed.success, true)
})

test('OrderCreateCheckoutBodySchema accepts legacy checkout payload with patronymic', () => {
  const payload = buildValidCheckoutPayload()
  payload.customer.patronymic = 'Петрівна'

  const parsed = OrderCreateCheckoutBodySchema.safeParse(payload)
  assert.equal(parsed.success, true)
  if (!parsed.success) return
  assert.equal(parsed.data.customer.patronymic, 'Петрівна')
})

test('OrderCreateCheckoutBodySchema requires surname', () => {
  const payload = buildValidCheckoutPayload()
  payload.customer.surname = ''

  const parsed = OrderCreateCheckoutBodySchema.safeParse(payload)
  assert.equal(parsed.success, false)
})
