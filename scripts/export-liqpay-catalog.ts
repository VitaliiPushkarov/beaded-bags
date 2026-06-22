import { prisma } from '../src/lib/prisma'
import {
  buildLiqPayCatalogRows,
  serializeLiqPayCatalogRows,
} from '../src/lib/liqpay-catalog'

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
  const rows = buildLiqPayCatalogRows(products)
  console.log(serializeLiqPayCatalogRows(rows))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
