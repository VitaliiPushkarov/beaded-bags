// Renders sample order emails to .preview/ so they can be opened in a browser
// (and dragged into a real mail client) without sending anything.
//
//   npm run preview:email

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildOrderEmail,
  type OrderEmailKind,
  type OrderEmailLocale,
  type OrderEmailOrder,
} from '../src/lib/order-email-template'

const OUT_DIR = join(process.cwd(), '.preview')

const domesticOrder: OrderEmailOrder = {
  shortNumber: 1042,
  subtotalUAH: 6300,
  discountUAH: 630,
  deliveryUAH: 0,
  totalUAH: 5670,
  paymentMethod: 'LIQPAY',
  shippingMethod: 'NOVA_POSHTA',
  npCityName: 'Кропивницький',
  npWarehouseName: 'Відділення №5 (до 30 кг)',
  customerName: 'Олена',
  customerSurname: 'Коваль',
  items: [
    {
      name: 'Сумка «Ґердан» вечірня',
      color: 'чорний',
      modelSize: null,
      pouchColor: 'молочний',
      strapName: 'Плетений ремінець',
      priceUAH: 2100,
      qty: 2,
      addons: [{ name: 'Брелок-квітка', qty: 1 }],
    },
    {
      name: 'Чохол для окулярів',
      color: 'бежевий',
      modelSize: null,
      pouchColor: null,
      strapName: null,
      priceUAH: 2100,
      qty: 1,
      addons: null,
    },
  ],
}

// Item names/colours are snapshotted from the cart, so a shopper on the English
// site has English values stored on the order.
const internationalOrder: OrderEmailOrder = {
  ...domesticOrder,
  shortNumber: 1043,
  paymentMethod: 'BANK_TRANSFER',
  items: [
    {
      name: 'Gerdan evening bag',
      color: 'black',
      modelSize: null,
      pouchColor: 'milk',
      strapName: 'Woven strap',
      priceUAH: 2100,
      qty: 2,
      addons: [{ name: 'Flower charm', qty: 1 }],
    },
    {
      name: 'Glasses case',
      color: 'beige',
      modelSize: null,
      pouchColor: null,
      strapName: null,
      priceUAH: 2100,
      qty: 1,
      addons: null,
    },
  ],
  shippingMethod: 'INTERNATIONAL_ADDRESS',
  shippingCountryName: 'Poland',
  shippingRegion: 'Mazowieckie',
  shippingCity: 'Warsaw',
  shippingPostalCode: '00-001',
  shippingAddressLine1: 'ul. Prosta 51/12',
  shippingAddressLine2: null,
  npCityName: null,
  npWarehouseName: null,
  customerName: 'Anna',
  customerSurname: 'Nowak',
}

// Mirrors what BANK_TRANSFER_DETAILS_UK would hold: static text only. The
// per-order payment reference is added by the template, not configured here.
const SAMPLE_BANK_DETAILS = [
  'Отримувач: ФОП Прізвище І. Б.',
  'IBAN: UA00 0000 0000 0000 0000 0000 000',
  'ЄДРПОУ: 0000000000',
].join('\n')

const cases: Array<{
  file: string
  order: OrderEmailOrder
  kind: OrderEmailKind
  locale: OrderEmailLocale
  bankTransferDetails?: string | null
  siteUrl: string
}> = [
  {
    file: 'order-paid-uk.html',
    order: domesticOrder,
    kind: 'PAID',
    locale: 'uk',
    siteUrl: 'https://gerdan.online',
  },
  {
    file: 'order-awaiting-payment-uk.html',
    order: { ...domesticOrder, paymentMethod: 'BANK_TRANSFER' },
    kind: 'AWAITING_PAYMENT',
    locale: 'uk',
    bankTransferDetails: SAMPLE_BANK_DETAILS,
    siteUrl: 'https://gerdan.online',
  },
  {
    file: 'order-awaiting-payment-en.html',
    order: internationalOrder,
    kind: 'AWAITING_PAYMENT',
    locale: 'en',
    bankTransferDetails: SAMPLE_BANK_DETAILS,
    siteUrl: 'https://en.gerdan.online',
  },
  {
    file: 'order-awaiting-payment-uk-no-details.html',
    order: { ...domesticOrder, paymentMethod: 'BANK_TRANSFER' },
    kind: 'AWAITING_PAYMENT',
    locale: 'uk',
    bankTransferDetails: null,
    siteUrl: 'https://gerdan.online',
  },
]

mkdirSync(OUT_DIR, { recursive: true })

for (const testCase of cases) {
  const { subject, html, text } = buildOrderEmail(testCase)
  writeFileSync(join(OUT_DIR, testCase.file), html, 'utf8')
  writeFileSync(
    join(OUT_DIR, testCase.file.replace(/\.html$/, '.txt')),
    `Subject: ${subject}\n\n${text}\n`,
    'utf8',
  )
  console.log(`${testCase.file}  —  ${subject}`)
}

console.log(`\nWrote ${cases.length} previews to ${OUT_DIR}`)
