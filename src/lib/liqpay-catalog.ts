export type LiqPayCatalogEntityType =
  | 'VARIANT'
  | 'STRAP'
  | 'POUCH'
  | 'SIZE'

export type LiqPayCatalogExportRow = {
  entityType: LiqPayCatalogEntityType
  entityId: string
  externalCode: string
  itemName: string
  price: number
  unitName: string
  vndcode: string
  codifier: string
  taxList: string
  categoryName: string
  barcode: string
  editablePrice: string
  weightProduct: string
}

type ProductCatalogSource = {
  slug: string
  name: string
  type: string
  basePriceUAH: number | null
  variants: Array<{
    id: string
    sku: string | null
    color: string | null
    modelSize: string | null
    pouchColor: string | null
    priceUAH: number | null
    discountUAH: number | null
    straps: Array<{
      id: string
      name: string
      extraPriceUAH: number
    }>
    pouches: Array<{
      id: string
      color: string
      extraPriceUAH: number
    }>
    sizes: Array<{
      id: string
      size: string
      extraPriceUAH: number
    }>
  }>
}

export const LIQPAY_CATALOG_HEADER =
  'item_name^price^unit_name^vndcode^codifier^tax_list^category_name^barcode^editable_price^weight_product'

const TYPE_CATEGORY_LABEL: Record<string, string> = {
  BAG: 'Сумки',
  BELT_BAG: 'Бананки',
  SHOPPER: 'Шопери',
  CASE: 'Чохли',
  ACCESSORY: 'Аксесуари',
  ORNAMENTS: 'Аксесуари',
}

const ENTITY_PREFIX: Record<LiqPayCatalogEntityType, string> = {
  VARIANT: 'vrn',
  STRAP: 'stp',
  POUCH: 'pch',
  SIZE: 'siz',
}

export function sanitizeLiqPayCatalogValue(value: string | null | undefined) {
  return String(value ?? '')
    .replaceAll('^', ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeLiqPayCatalogCode(code: string | null | undefined) {
  return sanitizeLiqPayCatalogValue(code).toLowerCase()
}

export function buildLiqPayCatalogExternalCode(
  entityType: LiqPayCatalogEntityType,
  entityId: string,
) {
  const cleanId = sanitizeLiqPayCatalogValue(entityId).toLowerCase()
  return normalizeLiqPayCatalogCode(`${ENTITY_PREFIX[entityType]}-${cleanId}`)
}

export function formatLiqPayCatalogPrice(price: number) {
  return (Math.round(price * 100) / 100).toFixed(2)
}

export function createLiqPayCategoryName(product: {
  type: string
  name: string
  slug: string
}) {
  const base = TYPE_CATEGORY_LABEL[product.type] ?? 'Товари'
  const haystack = `${product.name} ${product.slug}`.toLowerCase()

  if (product.type === 'ACCESSORY' || product.type === 'ORNAMENTS') {
    if (haystack.includes('brelok')) return 'Аксесуари / Брелоки'
    if (haystack.includes('gerdan')) return 'Аксесуари / Гердани'
    if (haystack.includes('sylyank')) return 'Аксесуари / Силянки'
    if (haystack.includes('mitenk')) return 'Аксесуари / Мітенки'
    if (haystack.includes('navushny')) return 'Аксесуари / Навушники'
    if (haystack.includes('sharf')) return 'Аксесуари / Шарфи'
    if (haystack.includes('rez')) return 'Аксесуари / Резинки'
    if (haystack.includes('shapk')) return 'Аксесуари / Шапки'
    if (haystack.includes('chepch')) return 'Аксесуари / Чепчики'
  }

  return base
}

export function buildLiqPayBaseName(input: {
  productName: string
  color?: string | null
  modelSize?: string | null
  pouchColor?: string | null
}) {
  const parts = [
    sanitizeLiqPayCatalogValue(input.color),
    sanitizeLiqPayCatalogValue(input.modelSize)
      ? `Розмір: ${sanitizeLiqPayCatalogValue(input.modelSize)}`
      : '',
    sanitizeLiqPayCatalogValue(input.pouchColor)
      ? `Мішечок: ${sanitizeLiqPayCatalogValue(input.pouchColor)}`
      : '',
  ].filter(Boolean)

  return parts.length
    ? `${sanitizeLiqPayCatalogValue(input.productName)} - ${parts.join(' / ')}`
    : sanitizeLiqPayCatalogValue(input.productName)
}

export function buildLiqPayOptionName(input: {
  baseName: string
  optionType: 'Ремінець' | 'Мішечок' | 'Розмір'
  optionValue: string
}) {
  return `Опція до ${sanitizeLiqPayCatalogValue(input.baseName)} / ${input.optionType}: ${sanitizeLiqPayCatalogValue(
    input.optionValue,
  )}`
}

export function buildLiqPayCatalogRows(products: ProductCatalogSource[]) {
  const rows: LiqPayCatalogExportRow[] = []
  const seen = new Set<string>()

  function pushRow(row: LiqPayCatalogExportRow) {
    const serialized = [
      row.externalCode,
      row.itemName,
      formatLiqPayCatalogPrice(row.price),
    ].join('|')

    if (seen.has(serialized)) return
    seen.add(serialized)
    rows.push(row)
  }

  for (const product of products) {
    const categoryName = createLiqPayCategoryName(product)

    for (const variant of product.variants) {
      const baseName = buildLiqPayBaseName({
        productName: product.name,
        color: variant.color,
        modelSize: variant.modelSize,
        pouchColor: variant.pouchColor,
      })
      const basePrice = Math.max(
        0,
        Number(variant.priceUAH ?? product.basePriceUAH ?? 0) -
          Number(variant.discountUAH ?? 0),
      )

      pushRow({
        entityType: 'VARIANT',
        entityId: variant.id,
        externalCode: buildLiqPayCatalogExternalCode('VARIANT', variant.id),
        itemName: baseName,
        price: basePrice,
        unitName: 'Штука',
        vndcode: buildLiqPayCatalogExternalCode('VARIANT', variant.id),
        codifier: '',
        taxList: 'А',
        categoryName,
        barcode: sanitizeLiqPayCatalogValue(variant.sku),
        editablePrice: 'T',
        weightProduct: 'F',
      })

      for (const strap of variant.straps) {
        const extra = Math.max(0, Number(strap.extraPriceUAH ?? 0))
        if (extra <= 0) continue

        pushRow({
          entityType: 'STRAP',
          entityId: strap.id,
          externalCode: buildLiqPayCatalogExternalCode('STRAP', strap.id),
          itemName: buildLiqPayOptionName({
            baseName,
            optionType: 'Ремінець',
            optionValue: strap.name,
          }),
          price: extra,
          unitName: 'Штука',
          vndcode: buildLiqPayCatalogExternalCode('STRAP', strap.id),
          codifier: '',
          taxList: 'А',
          categoryName: 'Опції / Ремінці',
          barcode: '',
          editablePrice: 'T',
          weightProduct: 'F',
        })
      }

      for (const pouch of variant.pouches) {
        const extra = Math.max(0, Number(pouch.extraPriceUAH ?? 0))
        if (extra <= 0) continue

        pushRow({
          entityType: 'POUCH',
          entityId: pouch.id,
          externalCode: buildLiqPayCatalogExternalCode('POUCH', pouch.id),
          itemName: buildLiqPayOptionName({
            baseName,
            optionType: 'Мішечок',
            optionValue: pouch.color,
          }),
          price: extra,
          unitName: 'Штука',
          vndcode: buildLiqPayCatalogExternalCode('POUCH', pouch.id),
          codifier: '',
          taxList: 'А',
          categoryName: 'Опції / Мішечки',
          barcode: '',
          editablePrice: 'T',
          weightProduct: 'F',
        })
      }

      for (const size of variant.sizes) {
        const extra = Math.max(0, Number(size.extraPriceUAH ?? 0))
        if (extra <= 0) continue

        pushRow({
          entityType: 'SIZE',
          entityId: size.id,
          externalCode: buildLiqPayCatalogExternalCode('SIZE', size.id),
          itemName: buildLiqPayOptionName({
            baseName,
            optionType: 'Розмір',
            optionValue: size.size,
          }),
          price: extra,
          unitName: 'Штука',
          vndcode: buildLiqPayCatalogExternalCode('SIZE', size.id),
          codifier: '',
          taxList: 'А',
          categoryName: 'Опції / Розміри',
          barcode: '',
          editablePrice: 'T',
          weightProduct: 'F',
        })
      }
    }
  }

  rows.sort((a, b) =>
    a.categoryName === b.categoryName
      ? a.itemName.localeCompare(b.itemName, 'uk')
      : a.categoryName.localeCompare(b.categoryName, 'uk'),
  )

  return rows
}

export function serializeLiqPayCatalogRows(rows: LiqPayCatalogExportRow[]) {
  return [LIQPAY_CATALOG_HEADER]
    .concat(
      rows.map((row) =>
        [
          sanitizeLiqPayCatalogValue(row.itemName),
          formatLiqPayCatalogPrice(row.price),
          row.unitName,
          sanitizeLiqPayCatalogValue(row.vndcode),
          row.codifier,
          row.taxList,
          sanitizeLiqPayCatalogValue(row.categoryName),
          row.barcode,
          row.editablePrice,
          row.weightProduct,
        ].join('^'),
      ),
    )
    .join('\n')
}

export function resolveLiqPayGoodId(args: {
  entityType: LiqPayCatalogEntityType
  entityId: string
  manualGoodId: number | null | undefined
  mappingsByExternalCode?: ReadonlyMap<string, number>
}) {
  if (args.manualGoodId && Number.isFinite(args.manualGoodId)) {
    return Math.trunc(args.manualGoodId)
  }

  const externalCode = buildLiqPayCatalogExternalCode(
    args.entityType,
    args.entityId,
  )

  return args.mappingsByExternalCode?.get(externalCode) ?? null
}
