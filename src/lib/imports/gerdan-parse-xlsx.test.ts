import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import * as XLSX from 'xlsx'

import { parseGerdanWorkbook } from './gerdan-parse-xlsx'

function createWorkbookFixture() {
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Загальна кількість товару', 'Загальна собівартість'],
      [13, 9355.47],
    ]),
    'Дашборд',
  )

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Курс долара:', 42, '2026 січень'],
      [
        'Дата',
        'Категорія',
        'Найменування',
        'Дод. Інформація',
        'Колір / Форма',
        'К-сть упаковок',
        'Од. виміру',
        'Кількість',
        'Ціна за од.',
        'Ціна, $',
        'Сума, грн',
        'Примітка',
      ],
      [null, 'Бусини', 'Керамічні намистини', '100 шт', 'мікс', 1, 'шт', 100, 1.5, 3.67, 152.67, 'ok'],
    ]),
    'Закупівлі',
  )

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [null, 'Найменування', 'Кабінет', 'Ціна, $', null, null, null, 'по факту', null, null],
      [null, 'Реклама січень', 'gerdan.studio', 174.19, null, null, null, 'приват', 3394.55],
      [null, 'Реклама лютий', 'gerdan.studio', 150.0, null, null, null, 'приват', null],
    ]),
    'реклама',
  )

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      [
        'Назва товару',
        'Матеріали (грн)',
        'Робота (грн)',
        'Пакування',
        'Собівартість виготовлення',
        'Податок (6%)',
        'Реклама',
        'Собівартісь, всього',
        'Ціна х2',
        'Ціна х3',
        'Комісія банку (1.5%)',
        'оптимальна ціна',
        'назви',
        null,
        null,
        null,
        null,
        null,
        null,
        ' ціна сайт',
      ],
      ['Рожева сумка', 560.31, 440, 65.94, null, 63.97, 0, 1130.23, null, null, null, null, 'Classic Mini', 'Рожева', '14 x 20 x 4 cm', null, null, null, null, 1799],
    ]),
    'Собівартість товарів',
  )

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Дата', 'Майстер', 'Найменування виробу', 'Тривалість (год)', 'Оплата за год', 'Сума', 'Оплата'],
      [null, 'Таня', 'Рожева сумка', 8, 55, 440, null],
    ]),
    'Робота',
  )

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Дата', 'Майстер', 'Найменування виробу', 'Кількість', 'Колір', 'Сума за од', 'Оплата'],
      [46020, 'Таня', 'Metalic case', 1, 'срібло', 250, 250],
    ]),
    'Лист2',
  )

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), 'Лист1')

  return workbook
}

test('parseGerdanWorkbook reads supported sheets into staging JSON shape', () => {
  const tempFile = path.join(os.tmpdir(), `gerdan-fixture-${Date.now()}.xlsx`)
  XLSX.writeFile(createWorkbookFixture(), tempFile)

  try {
    const stage = parseGerdanWorkbook(tempFile)

    assert.equal(stage.sheets.purchases.monthBlocks.length, 1)
    assert.equal(stage.sheets.purchases.monthBlocks[0]?.items.length, 1)
    assert.equal(stage.sheets.ads.rows.length, 2)
    assert.equal(stage.sheets.productCosts.rows.length, 1)
    assert.equal(stage.sheets.workLog.rows.length, 1)
    assert.equal(stage.sheets.workLedger.rows.length, 1)
    assert.equal(stage.sheets.ignored.length, 1)
    assert.equal(stage.sheets.ignored[0]?.sheetName, 'Лист1')
  } finally {
    fs.rmSync(tempFile, { force: true })
  }
})
