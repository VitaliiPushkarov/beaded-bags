import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildItemOptionParts,
  buildOrderEmail,
  buildOrderEmailSubject,
  buildOrderEmailText,
  buildShippingLines,
  formatOrderAmount,
  resolveOrderEmailLocale,
  type OrderEmailOrder,
} from './order-email-template'

function buildOrder(overrides: Partial<OrderEmailOrder> = {}): OrderEmailOrder {
  return {
    shortNumber: 1042,
    subtotalUAH: 4200,
    discountUAH: 0,
    deliveryUAH: 0,
    totalUAH: 4200,
    paymentMethod: 'LIQPAY',
    shippingMethod: 'NOVA_POSHTA',
    npCityName: 'Кропивницький',
    npWarehouseName: 'Відділення №5',
    customerName: 'Олена',
    customerSurname: 'Коваль',
    items: [
      {
        name: 'Сумка Ґердан',
        color: 'чорний',
        modelSize: null,
        pouchColor: null,
        strapName: 'Плетений ремінець',
        priceUAH: 2100,
        qty: 2,
        addons: [{ name: 'Брелок', qty: 1 }],
      },
    ],
    ...overrides,
  }
}

test('amounts are grouped deterministically, without ICU', () => {
  assert.equal(formatOrderAmount(4200), '4 200 ₴')
  assert.equal(formatOrderAmount(980), '980 ₴')
  assert.equal(formatOrderAmount(1234567), '1 234 567 ₴')
  assert.equal(formatOrderAmount(-50), '0 ₴')
  assert.equal(formatOrderAmount(Number.NaN), '0 ₴')
})

test('locale follows the shipping method', () => {
  assert.equal(resolveOrderEmailLocale({ shippingMethod: 'NOVA_POSHTA' }), 'uk')
  assert.equal(
    resolveOrderEmailLocale({ shippingMethod: 'INTERNATIONAL_ADDRESS' }),
    'en',
  )
  assert.equal(resolveOrderEmailLocale({ shippingMethod: null }), 'uk')
})

test('item options list every chosen variation', () => {
  const parts = buildItemOptionParts(buildOrder().items[0], 'uk')
  assert.deepEqual(parts, [
    'колір: чорний',
    'ремінець: Плетений ремінець',
    'додатково: Брелок',
  ])
})

test('item options skip empty values and non-array addons', () => {
  const parts = buildItemOptionParts(
    {
      name: 'Чохол',
      color: '  ',
      modelSize: null,
      pouchColor: null,
      strapName: null,
      priceUAH: 500,
      qty: 1,
      addons: 'not-an-array',
    },
    'uk',
  )
  assert.deepEqual(parts, [])
})

test('Nova Poshta delivery lines carry city and warehouse', () => {
  assert.deepEqual(buildShippingLines(buildOrder(), 'uk'), [
    'Нова пошта',
    'Кропивницький',
    'Відділення №5',
  ])
})

test('placeholder warehouse value is not shown to the customer', () => {
  const lines = buildShippingLines(
    buildOrder({ npWarehouseName: 'НЕ ВКАЗАНО' }),
    'uk',
  )
  assert.deepEqual(lines, ['Нова пошта', 'Кропивницький'])
})

test('international delivery lines use the postal address', () => {
  const lines = buildShippingLines(
    buildOrder({
      shippingMethod: 'INTERNATIONAL_ADDRESS',
      shippingCountryName: 'Poland',
      shippingRegion: 'Mazowieckie',
      shippingCity: 'Warsaw',
      shippingPostalCode: '00-001',
      shippingAddressLine1: 'ul. Prosta 1',
      shippingAddressLine2: null,
      npCityName: null,
      npWarehouseName: null,
    }),
    'en',
  )
  assert.deepEqual(lines, ['Poland', 'Mazowieckie', '00-001 Warsaw', 'ul. Prosta 1'])
})

test('subjects distinguish a confirmed order from one awaiting payment', () => {
  const order = buildOrder()

  assert.match(
    buildOrderEmailSubject({ order, kind: 'PAID', locale: 'uk' }),
    /Замовлення #1042 підтверджено/,
  )
  assert.match(
    buildOrderEmailSubject({ order, kind: 'AWAITING_PAYMENT', locale: 'uk' }),
    /реквізити для оплати/,
  )
  assert.match(
    buildOrderEmailSubject({ order, kind: 'PAID', locale: 'en' }),
    /Order #1042 confirmed/,
  )
})

test('the awaiting-payment email carries the configured bank details', () => {
  const text = buildOrderEmailText({
    order: buildOrder({ paymentMethod: 'BANK_TRANSFER' }),
    kind: 'AWAITING_PAYMENT',
    locale: 'uk',
    bankTransferDetails: 'IBAN UA00 0000 0000',
    siteUrl: 'https://gerdan.online',
  })

  assert.match(text, /РЕКВІЗИТИ ДЛЯ ОПЛАТИ/)
  assert.match(text, /IBAN UA00 0000 0000/)
})

test('bank details always carry the order number as the payment reference', () => {
  // The configured details are static text, so without this the merchant cannot
  // match an incoming transfer to an order.
  const uk = buildOrderEmailText({
    order: buildOrder({ shortNumber: 1042, paymentMethod: 'BANK_TRANSFER' }),
    kind: 'AWAITING_PAYMENT',
    locale: 'uk',
    bankTransferDetails: 'IBAN UA00 0000 0000',
    siteUrl: 'https://gerdan.online',
  })
  assert.match(uk, /Призначення платежу: Замовлення #1042/)

  const { html } = buildOrderEmail({
    order: buildOrder({ shortNumber: 1042, paymentMethod: 'BANK_TRANSFER' }),
    kind: 'AWAITING_PAYMENT',
    locale: 'en',
    bankTransferDetails: 'IBAN UA00 0000 0000',
    siteUrl: 'https://en.gerdan.online',
  })
  assert.match(html, /Payment reference: Order #1042/)
})

test('no payment reference is shown when there are no details to reference', () => {
  const text = buildOrderEmailText({
    order: buildOrder({ paymentMethod: 'BANK_TRANSFER' }),
    kind: 'AWAITING_PAYMENT',
    locale: 'uk',
    bankTransferDetails: null,
    siteUrl: 'https://gerdan.online',
  })

  assert.doesNotMatch(text, /Призначення платежу/)
})

test('missing bank details degrade to a promise rather than an empty block', () => {
  const text = buildOrderEmailText({
    order: buildOrder({ paymentMethod: 'BANK_TRANSFER' }),
    kind: 'AWAITING_PAYMENT',
    locale: 'uk',
    bankTransferDetails: null,
    siteUrl: 'https://gerdan.online',
  })

  assert.match(text, /надішлемо реквізити окремим повідомленням/)
})

test('a paid email never shows a payment-details block', () => {
  const text = buildOrderEmailText({
    order: buildOrder(),
    kind: 'PAID',
    locale: 'uk',
    bankTransferDetails: 'IBAN UA00 0000 0000',
    siteUrl: 'https://gerdan.online',
  })

  assert.doesNotMatch(text, /IBAN/)
  assert.match(text, /номер накладної/)
})

test('discount is only shown when there is one', () => {
  const withoutDiscount = buildOrderEmailText({
    order: buildOrder(),
    kind: 'PAID',
    locale: 'uk',
    siteUrl: 'https://gerdan.online',
  })
  assert.doesNotMatch(withoutDiscount, /Знижка/)

  const withDiscount = buildOrderEmailText({
    order: buildOrder({ discountUAH: 420, totalUAH: 3780 }),
    kind: 'PAID',
    locale: 'uk',
    siteUrl: 'https://gerdan.online',
  })
  assert.match(withDiscount, /Знижка: −420 ₴/)
})

test('line totals multiply unit price by quantity', () => {
  const text = buildOrderEmailText({
    order: buildOrder(),
    kind: 'PAID',
    locale: 'uk',
    siteUrl: 'https://gerdan.online',
  })

  // 2100 x 2
  assert.match(text, /4 200 ₴/)
})

test('international orders explain that the amount is stated in UAH', () => {
  const text = buildOrderEmailText({
    order: buildOrder({ shippingMethod: 'INTERNATIONAL_ADDRESS' }),
    kind: 'AWAITING_PAYMENT',
    locale: 'en',
    siteUrl: 'https://en.gerdan.online',
  })

  assert.match(text, /amount is shown in UAH/)
})

test('html escapes customer-controlled values', () => {
  const { html } = buildOrderEmail({
    order: buildOrder({
      customerName: '<script>alert(1)</script>',
      items: [
        {
          name: 'Bag "A" & <b>B</b>',
          color: null,
          modelSize: null,
          pouchColor: null,
          strapName: null,
          priceUAH: 100,
          qty: 1,
          addons: null,
        },
      ],
    }),
    kind: 'PAID',
    locale: 'uk',
    siteUrl: 'https://gerdan.online',
  })

  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /Bag &quot;A&quot; &amp; &lt;b&gt;B&lt;\/b&gt;/)
})

test('buildOrderEmail returns all three renderings', () => {
  const result = buildOrderEmail({
    order: buildOrder(),
    kind: 'PAID',
    locale: 'uk',
    siteUrl: 'https://gerdan.online',
  })

  assert.ok(result.subject.length > 0)
  assert.match(result.html, /^<!doctype html>/)
  assert.ok(result.text.includes('Сумка Ґердан'))
})
