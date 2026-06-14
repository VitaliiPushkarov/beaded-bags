import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildOrderTelegramMediaGroups,
  buildOrderTelegramMessage,
  buildOrderTelegramPhotoCaption,
  resolveOrderTelegramPreviewImage,
  resolveOrderTelegramPreviewImages,
} from './order-telegram'

function buildOrderFixture() {
  return {
    id: 'order-1',
    shortNumber: 123,
    totalUAH: 4200,
    paymentMethod: 'LIQPAY',
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
