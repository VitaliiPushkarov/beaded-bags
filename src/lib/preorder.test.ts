import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildFallbackPreorderItems,
  buildPreorderMailtoBody,
  buildPreorderTelegramMessage,
  formatUaPhone,
  isUaPhoneValid,
  normalizeUaPhone,
  normalizePreorderItems,
} from './preorder'

test('normalizePreorderItems keeps valid preorder addons and normalizes values', () => {
  const items = normalizePreorderItems([
    {
      productId: 'prod-main',
      productSlug: 'classic-mini',
      productName: 'Classic Mini',
      variantId: 'variant-main',
      variantLabel: 'Classic Mini — Червоний',
      variantColor: '  Червоний  ',
      strapName: 'Ланцюжок',
      priceUAH: 4200.4,
      qty: 1,
    },
    {
      productId: 'prod-addon',
      productName: 'Брелок',
      variantId: 'variant-addon',
      kind: 'addon',
      priceUAH: 300,
      qty: 2,
    },
    {
      productId: '',
      productName: 'Invalid',
      variantId: 'broken',
    },
  ])

  assert.equal(items.length, 2)
  assert.equal(items[0]?.variantColor, 'Червоний')
  assert.equal(items[0]?.priceUAH, 4200)
  assert.equal(items[1]?.kind, 'addon')
  assert.equal(items[1]?.qty, 2)
})

test('buildPreorderTelegramMessage includes addon items and total', () => {
  const items = normalizePreorderItems([
    {
      productId: 'prod-main',
      productSlug: 'classic-mini',
      productName: 'Classic Mini',
      variantId: 'variant-main',
      variantLabel: 'Classic Mini — Червоний',
      strapName: 'Ланцюжок',
      priceUAH: 4200,
      qty: 1,
    },
    {
      productId: 'prod-addon',
      productSlug: 'fortune-brelok',
      productName: 'Fortune & Charm',
      variantId: 'variant-addon',
      variantLabel: 'Fortune & Charm — Blue',
      kind: 'addon',
      priceUAH: 300,
      qty: 1,
    },
  ])

  const message = buildPreorderTelegramMessage({
    leadId: 'lead-1',
    items,
    contact: '+380501112233',
    contactName: 'Марія <script>',
    comment: 'Терміново',
    url: 'https://gerdan.online/products/classic-mini',
  })

  assert.match(message, /Classic Mini — Червоний/)
  assert.match(message, /Доповнення: Fortune &amp; Charm — Blue/)
  assert.match(message, /Ланцюжок/)
  assert.match(message, /4500 ₴/)
  assert.match(message, /Марія &lt;script&gt;/)
})

test('buildPreorderMailtoBody includes the full preorder item list', () => {
  const items = buildFallbackPreorderItems({
    productId: 'prod-main',
    productSlug: 'classic-mini',
    productName: 'Classic Mini',
    variantId: 'variant-main',
    variantLabel: 'Classic Mini — Червоний',
    strapName: 'Ланцюжок',
    priceUAH: 4200,
  }).concat(
    normalizePreorderItems([
      {
        productId: 'prod-addon',
        productName: 'Брелок',
        variantId: 'variant-addon',
        variantLabel: 'Брелок — Синій',
        kind: 'addon',
        priceUAH: 300,
      },
    ]),
  )

  const body = buildPreorderMailtoBody({
    items,
    pageUrl: 'https://gerdan.online/products/classic-mini',
    contactName: 'Марія',
    contact: '+380501112233',
    comment: 'Передзвоніть після 18:00',
  })

  assert.match(body, /Classic Mini — Червоний/)
  assert.match(body, /Доповнення: Брелок — Синій/)
  assert.match(body, /Сторінка: https:\/\/gerdan\.online\/products\/classic-mini/)
  assert.match(body, /Телефон: \+380501112233/)
})

test('ua preorder phone helpers normalize and format valid numbers', () => {
  assert.equal(normalizeUaPhone('050 111 22 33'), '380501112233')
  assert.equal(normalizeUaPhone('+380 50 111 22 33'), '380501112233')
  assert.equal(normalizeUaPhone('501112233'), '380501112233')
  assert.equal(formatUaPhone('0501112233'), '+380 50 111 22 33')
  assert.equal(isUaPhoneValid('+380 50 111 22 33'), true)
  assert.equal(isUaPhoneValid('hello world'), false)
})
