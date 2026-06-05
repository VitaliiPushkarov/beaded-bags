import { prisma } from '../src/lib/prisma'

type CatalogRow = {
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

const HEADER =
  'item_name^price^unit_name^vndcode^codifier^tax_list^category_name^barcode^editable_price^weight_product'

const TYPE_CATEGORY_LABEL: Record<string, string> = {
  BAG: 'Сумки',
  BELT_BAG: 'Бананки',
  SHOPPER: 'Шопери',
  CASE: 'Чохли',
  ACCESSORY: 'Аксесуари',
  ORNAMENTS: 'Аксесуари',
}

function sanitize(value: string | null | undefined) {
  return String(value ?? '')
    .replaceAll('^', ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatPrice(price: number) {
  return (Math.round(price * 100) / 100).toFixed(2)
}

function createCategoryName(product: {
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

function buildBaseName(input: {
  productName: string
  color?: string | null
  modelSize?: string | null
  pouchColor?: string | null
}) {
  const parts = [
    sanitize(input.color),
    sanitize(input.modelSize)
      ? `Розмір: ${sanitize(input.modelSize)}`
      : '',
    sanitize(input.pouchColor)
      ? `Мішечок: ${sanitize(input.pouchColor)}`
      : '',
  ].filter(Boolean)

  return parts.length
    ? `${sanitize(input.productName)} - ${parts.join(' / ')}`
    : sanitize(input.productName)
}

function buildOptionName(input: {
  baseName: string
  optionType: 'Ремінець' | 'Мішечок' | 'Розмір'
  optionValue: string
}) {
  return `Опція до ${sanitize(input.baseName)} / ${input.optionType}: ${sanitize(
    input.optionValue,
  )}`
}

async function main() {
  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED', inStock: true },
    orderBy: [{ sortCatalog: 'asc' }, { createdAt: 'desc' }],
    select: {
      slug: true,
      name: true,
      type: true,
      basePriceUAH: true,
      variants: {
        orderBy: [{ sortCatalog: 'asc' }, { id: 'asc' }],
        where: { inStock: true },
        select: {
          id: true,
          sku: true,
          color: true,
          modelSize: true,
          pouchColor: true,
          priceUAH: true,
          discountUAH: true,
          straps: {
            orderBy: { sort: 'asc' },
            select: { id: true, name: true, extraPriceUAH: true },
          },
          pouches: {
            orderBy: { sort: 'asc' },
            select: { id: true, color: true, extraPriceUAH: true },
          },
          sizes: {
            orderBy: { sort: 'asc' },
            select: { id: true, size: true, extraPriceUAH: true },
          },
        },
      },
    },
  })

  const rows: CatalogRow[] = []
  const seen = new Set<string>()

  function pushRow(row: CatalogRow) {
    const serialized = [
      row.itemName,
      formatPrice(row.price),
      row.vndcode,
      row.categoryName,
    ].join('|')
    if (seen.has(serialized)) return
    seen.add(serialized)
    rows.push(row)
  }

  for (const product of products) {
    const categoryName = createCategoryName(product)

    for (const variant of product.variants) {
      const baseName = buildBaseName({
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
      const baseCode = sanitize(
        variant.sku || `${product.slug}-${variant.id.slice(-6)}`,
      )

      pushRow({
        itemName: baseName,
        price: basePrice,
        unitName: 'Штука',
        vndcode: baseCode,
        codifier: '',
        taxList: 'А',
        categoryName,
        barcode: '',
        editablePrice: 'T',
        weightProduct: 'F',
      })

      for (const strap of variant.straps) {
        const extra = Math.max(0, Number(strap.extraPriceUAH ?? 0))
        if (extra <= 0) continue

        pushRow({
          itemName: buildOptionName({
            baseName,
            optionType: 'Ремінець',
            optionValue: strap.name,
          }),
          price: extra,
          unitName: 'Штука',
          vndcode: sanitize(`${baseCode}-strap-${strap.id.slice(-6)}`),
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
          itemName: buildOptionName({
            baseName,
            optionType: 'Мішечок',
            optionValue: pouch.color,
          }),
          price: extra,
          unitName: 'Штука',
          vndcode: sanitize(`${baseCode}-pouch-${pouch.id.slice(-6)}`),
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
          itemName: buildOptionName({
            baseName,
            optionType: 'Розмір',
            optionValue: size.size,
          }),
          price: extra,
          unitName: 'Штука',
          vndcode: sanitize(`${baseCode}-size-${size.id.slice(-6)}`),
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

  console.log(
    [HEADER]
      .concat(
        rows.map((row) =>
          [
            sanitize(row.itemName),
            formatPrice(row.price),
            row.unitName,
            sanitize(row.vndcode),
            row.codifier,
            row.taxList,
            sanitize(row.categoryName),
            row.barcode,
            row.editablePrice,
            row.weightProduct,
          ].join('^'),
        ),
      )
      .join('\n'),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
