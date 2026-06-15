import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildOrderTelegramMediaGroups,
  buildOrderTelegramMessage,
  buildOrderTelegramPhotoCaption,
  resolveOrderTelegramPreviewImage,
  resolveOrderTelegramPreviewImages,
} from './order-telegram'

type OrderFixture = {
  id: string
  shortNumber: number
  totalUAH: number
  paymentMethod: string
  shippingMethod: string
  shippingCountryCode: string
  shippingCountryName: string
  shippingRegion?: string | null
  shippingCity?: string | null
  shippingPostalCode?: string | null
  shippingAddressLine1?: string | null
  shippingAddressLine2?: string | null
  npCityName: string | null
  npWarehouseName: string | null
  customerName: string
  customerSurname: string
  customerPatronymic: string | null
  customerPhone: string
  customerEmail: string
  items: Array<{
    name: string
    color: string | null
    modelSize: string | null
    pouchColor: string | null
    strapName: string | null
    priceUAH: number
    qty: number
    image: string
    addons: Array<{ name: string }>
  }>
}

function buildOrderFixture(): OrderFixture {
  return {
    id: 'order-1',
    shortNumber: 123,
    totalUAH: 4200,
    paymentMethod: 'LIQPAY',
    shippingMethod: 'NOVA_POSHTA',
    shippingCountryCode: 'UA',
    shippingCountryName: 'Ukraine',
    npCityName: 'Київ',
    npWarehouseName: 'Відділення 1',
    customerName: 'Марія',
    customerSurname: 'Іваненко',
    customerPatronymic: null,
    customerPhone: '+380501112233',
    customerEmail: 'maria@example.com',
    items: [
      {
        name: 'Classic Mini',
        color: 'Червоний',
        modelSize: null,
        pouchColor: null,
        strapName: 'Ланцюжок',
        priceUAH: 4200,
        qty: 1,
        image: '/img/classic-mini-pink-01.jpg',
        addons: [{ name: 'Брелок' }],
      },
    ],
  }
}

test('resolveOrderTelegramPreviewImage converts relative image path to absolute site URL', () => {
  const image = resolveOrderTelegramPreviewImage(buildOrderFixture())

  assert.equal(image, 'https://gerdan.online/img/classic-mini-pink-01.jpg')
})

test('resolveOrderTelegramPreviewImages returns unique absolute URLs in item order', () => {
  const order = buildOrderFixture()
  order.items.push(
    {
      ...order.items[0],
      image: 'https://cdn.example.com/bag-2.jpg',
    },
    {
      ...order.items[0],
      image: '/img/classic-mini-pink-01.jpg',
    },
    {
      ...order.items[0],
      image: '  ',
    },
  )

  const images = resolveOrderTelegramPreviewImages(order)

  assert.deepEqual(images, [
    'https://gerdan.online/img/classic-mini-pink-01.jpg',
    'https://cdn.example.com/bag-2.jpg',
  ])
})

test('buildOrderTelegramPhotoCaption includes order summary for photo preview', () => {
  const caption = buildOrderTelegramPhotoCaption(buildOrderFixture())

  assert.match(caption, /Нове замовлення #123/)
  assert.match(caption, /Classic Mini/)
  assert.match(caption, /4200 ₴/)
  assert.match(caption, /Марія Іваненко/)
})

test('buildOrderTelegramMessage escapes html-sensitive customer and item fields', () => {
  const order = buildOrderFixture()
  order.customerName = 'Марія <script>'
  order.items[0].name = 'Bag & Chain'

  const message = buildOrderTelegramMessage(order)

  assert.match(message, /Марія &lt;script&gt; Іваненко/)
  assert.match(message, /Bag &amp; Chain/)
})

test('buildOrderTelegramMessage renders international shipping details', () => {
  const order = buildOrderFixture()
  order.shippingMethod = 'INTERNATIONAL_ADDRESS'
  order.shippingCountryCode = 'PL'
  order.shippingCountryName = 'Poland'
  order.shippingRegion = 'Mazowieckie'
  order.shippingCity = 'Warsaw'
  order.shippingPostalCode = '00-001'
  order.shippingAddressLine1 = 'Marszalkowska 10'
  order.shippingAddressLine2 = 'Apt 5'
  order.npCityName = null
  order.npWarehouseName = null

  const message = buildOrderTelegramMessage(order)

  assert.match(message, /Міжнародна доставка/)
  assert.match(message, /Польща/)
  assert.match(message, /00-001 Warsaw/)
  assert.match(message, /Marszalkowska 10/)
})

test('buildOrderTelegramMediaGroups chunks images and adds caption only to first album item', () => {
  const order = buildOrderFixture()
  order.items = Array.from({ length: 12 }, (_, index) => ({
    ...order.items[0],
    image: `/img/product-${index + 1}.jpg`,
  }))

  const groups = buildOrderTelegramMediaGroups(order)

  assert.equal(groups.length, 2)
  assert.equal(groups[0]?.length, 10)
  assert.equal(groups[1]?.length, 2)
  assert.equal(groups[0]?.[0]?.caption?.includes('Нове замовлення #123'), true)
  assert.equal(groups[0]?.[0]?.parse_mode, 'HTML')
  assert.equal(groups[0]?.[1]?.caption, undefined)
  assert.equal(groups[1]?.[0]?.caption, undefined)
})
