import assert from 'node:assert/strict'
import test from 'node:test'

import * as XLSX from 'xlsx'

import {
  planLiqPayMappingRows,
  readLiqPayWorkbook,
  type CatalogIndex,
} from './liqpay-catalog-sync'
import {
  buildLiqPayCatalogRows,
  normalizeLiqPayItemName,
} from './liqpay-catalog'

function index(
  entries: Array<{ name: string; code: string; price: number; sku?: string }>,
): CatalogIndex {
  const byName = new Map<string, { externalCode: string; priceUAH: number }>()
  const bySku = new Map<string, Array<{ externalCode: string; priceUAH: number }>>()

  for (const entry of entries) {
    const value = { externalCode: entry.code, priceUAH: entry.price }
    const key = normalizeLiqPayItemName(entry.name)
    if (!byName.has(key)) byName.set(key, value)
    if (entry.sku) bySku.set(entry.sku, [...(bySku.get(entry.sku) ?? []), value])
  }

  return { byName, bySku, entities: new Map() }
}

function row(id: number, name: string, price: number, vndcode = '') {
  return { id: String(id), name, price: String(price), vndcode }
}

test('a name is matched despite apostrophe and dash typography', () => {
  const plan = planLiqPayMappingRows(
    [row(27778567, "Чохол для телефону в'язаний - Небесний", 950)],
    index([
      {
        name: 'Чохол для телефону вʼязаний — Небесний',
        code: 'vrn-case-sky',
        price: 950,
      },
    ]),
  )

  assert.equal(plan.unmatched.length, 0)
  assert.deepEqual(
    plan.resolved.map((entry) => [entry.externalCode, entry.matchedBy]),
    [['vrn-case-sky', 'name']],
  )
})

test('our own external code in vndcode wins over everything', () => {
  const plan = planLiqPayMappingRows(
    [row(123, 'Будь-яка інша назва', 100, 'VRN-Some-Id')],
    index([{ name: 'Будь-яка інша назва', code: 'vrn-other', price: 100 }]),
  )

  assert.deepEqual(
    plan.resolved.map((entry) => [entry.externalCode, entry.matchedBy]),
    [['vrn-some-id', 'code']],
  )
})

test('a SKU reused by two goods maps neither of them', () => {
  // Real case: 2026122 is on both "Брелок на сумку рожевий - Відпустка" and
  // "Брелок на сумку морський рожевий - Відпустка". Binding either one to the
  // single variant that carries that SKU would put the wrong product on a
  // receipt.
  const plan = planLiqPayMappingRows(
    [
      row(29080368, 'Брелок на сумку рожевий - Відпустка', 380, '2026122'),
      row(29079199, 'Брелок на сумку морський рожевий - Відпустка', 380, '2026122'),
    ],
    index([
      {
        name: 'Брелок на сумку рожевий - Відпустка',
        code: 'vrn-pink-vacation',
        price: 380,
        sku: '2026122',
      },
    ]),
  )

  // The first is still identified by its name; the second has nothing left.
  assert.deepEqual(
    plan.resolved.map((entry) => [entry.liqpayGoodId, entry.matchedBy]),
    [[29080368, 'name']],
  )
  assert.deepEqual(
    plan.unmatched.map((good) => [good.liqpayGoodId, good.reason]),
    [[29079199, 'unknown']],
  )
})

test('a SKU never steals an entity a name already claimed', () => {
  // Real case: good 28066730 is "Світло-блакитний" but carries the SKU of the
  // "Жовтий" variant, which good 27778494 already matched by name.
  const plan = planLiqPayMappingRows(
    [
      row(27778494, 'Брелок міні вʼязана квітка - Жовтий', 360, '4324'),
      row(28066730, 'Брелок міні вʼязана квітка - Світло-блакитний', 380, '432404'),
    ],
    index([
      {
        name: 'Брелок міні вʼязана квітка - Жовтий',
        code: 'vrn-flower-yellow',
        price: 380,
        sku: '432404',
      },
    ]),
  )

  assert.deepEqual(
    plan.resolved.map((entry) => [entry.liqpayGoodId, entry.externalCode]),
    [[27778494, 'vrn-flower-yellow']],
  )
  assert.deepEqual(
    plan.unmatched.map((good) => [good.liqpayGoodId, good.reason]),
    [[28066730, 'unknown']],
  )
})

test('a stale catalogue price does not prevent a SKU match', () => {
  // The ПРРО catalogue lags the shop — that drift is the reason for syncing, so
  // it must not be a reason to refuse the mapping.
  const plan = planLiqPayMappingRows(
    [row(27778493, 'Назва, якої в нас немає', 360, '4321')],
    index([
      {
        name: 'Брелок міні вʼязана квітка — Джинс',
        code: 'vrn-flower-denim',
        price: 380,
        sku: '4321',
      },
    ]),
  )

  assert.deepEqual(
    plan.resolved.map((entry) => [entry.externalCode, entry.matchedBy]),
    [['vrn-flower-denim', 'sku']],
  )
})

test('a UTF-8 CSV from the ПРРО cabinet keeps its Cyrillic names', () => {
  // Read as a byte array, XLSX assumes a single-byte codepage and turns "Сумка"
  // into "Ð¡ÑÐ¼ÐºÐ°". Nothing throws — the names simply stop matching, and the
  // import quietly degrades to guessing from SKUs.
  const csv =
    'id,name,codifier,price,unit_name,barcode,vndcode\n' +
    '29079215,Сумка на плече з бантиками Candy - Рожевий,,1990.00,Штука,,6977\n'

  const workbook = readLiqPayWorkbook(new TextEncoder().encode(csv))
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[workbook.SheetNames[0]!]!,
    { defval: '' },
  )

  assert.equal(
    String(rows[0]?.name),
    'Сумка на плече з бантиками Candy - Рожевий',
  )
})

test('a byte-order mark does not become part of the first header', () => {
  const csv = '﻿id,name,price,vndcode\n123,Тест,100,1\n'
  const workbook = readLiqPayWorkbook(new TextEncoder().encode(csv))
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[workbook.SheetNames[0]!]!,
    { defval: '' },
  )

  assert.deepEqual(Object.keys(rows[0] ?? {}), ['id', 'name', 'price', 'vndcode'])
})

test('two categories reaching the same item map it once, not twice', () => {
  // Real case: "Дармовис ... Різнокольоровий" and "... Різнокольорий" live in
  // different export files and share SKU 202651. Planned together the second is
  // reported; planned separately it would overwrite the first.
  const plan = planLiqPayMappingRows(
    [
      row(27778527, 'Дармовис з намистин для ключів - Різнокольоровий', 400, '202651'),
      row(28390170, 'Дармовис з намистин для ключів - Різнокольорий', 450, '202651'),
    ],
    index([
      {
        name: 'Дармовис з намистин для ключів - Різнокольоровий',
        code: 'vrn-keychain-multi',
        price: 550,
        sku: '202651',
      },
    ]),
  )

  assert.equal(plan.resolved.length, 1)
  assert.equal(plan.resolved[0]?.liqpayGoodId, 27778527)
  assert.deepEqual(
    plan.unmatched.map((good) => [good.liqpayGoodId, good.reason]),
    [[28390170, 'unknown']],
  )
})

test('rows without a good ID are skipped, not mapped', () => {
  const plan = planLiqPayMappingRows(
    [{ id: '', name: 'Порожній рядок', price: '100', vndcode: '' }],
    index([{ name: 'Порожній рядок', code: 'vrn-x', price: 100 }]),
  )

  assert.equal(plan.skipped, 1)
  assert.equal(plan.resolved.length, 0)
  assert.equal(plan.unmatched.length, 0)
})

test('a good carrying our code beats a same-named duplicate listed before it', () => {
  // Uploading our export made the cabinet create a second "Tote - Рожевий
  // лимонад" carrying vrn-…, next to the hand-made one. Row order must not
  // decide which of the two the shop ends up fiscalizing against.
  const plan = planLiqPayMappingRows(
    [
      row(27778574, "Сумка в'язана велика Tote - Рожевий лимонад", 2490, '3543203'),
      row(29280287, "Сумка в'язана велика Tote - Рожевий лимонад", 2490, 'vrn-tote-pink'),
    ],
    index([
      {
        name: "Сумка в'язана велика Tote - Рожевий лимонад",
        code: 'vrn-tote-pink',
        price: 2490,
        sku: '3543203',
      },
    ]),
  )

  assert.deepEqual(
    plan.resolved.map((entry) => [entry.liqpayGoodId, entry.matchedBy]),
    [[29280287, 'code']],
  )
  // The older copy is reported as a duplicate to delete, not as something to
  // type into the product form.
  assert.deepEqual(
    plan.unmatched.map((good) => [good.liqpayGoodId, good.reason, good.duplicateOfGoodId]),
    [[27778574, 'duplicate', 29280287]],
  )
})

test('the export writes the article to vndcode and leaves the barcode empty', () => {
  // vndcode is what the cabinet matches an imported row against. Writing our
  // internal code there matched nothing, so every upload duplicated every good
  // and pushed the shop article into the barcode column.
  const rows = buildLiqPayCatalogRows([
    {
      slug: 'tote',
      name: "Сумка в'язана велика Tote",
      type: 'BAG',
      basePriceUAH: 2490,
      variants: [
        {
          id: 'cmp7jcue1000mky04go8hkfdm',
          sku: '3543203',
          color: 'Рожевий лимонад',
          modelSize: null,
          pouchColor: null,
          priceUAH: 2490,
          discountPercent: 0,
          discountUAH: 0,
          straps: [{ id: 'strap-abc123', name: 'Ланцюжок', extraPriceUAH: 420 }],
          pouches: [],
          sizes: [],
        },
      ],
    },
  ])

  const variantRow = rows.find((r) => r.entityType === 'VARIANT')!
  assert.equal(variantRow.vndcode, '3543203')
  assert.equal(variantRow.barcode, '')

  // An option has no SKU of its own, so it derives a stable one from the parent.
  const strapRow = rows.find((r) => r.entityType === 'STRAP')!
  assert.equal(strapRow.vndcode, '3543203-stp-abc123')
  assert.equal(strapRow.barcode, '')

  // The external code is still carried internally for mapping.
  assert.equal(variantRow.externalCode, 'vrn-cmp7jcue1000mky04go8hkfdm')
})
