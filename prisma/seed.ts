import { PrismaClient, ProductType } from '@prisma/client'

// ⚠️ В seed краще не використовувати alias `@/` — під ts-node/tsx він часто не працює.
// Замінюємо на відносний шлях з папки prisma → у ваш src/lib:
import { PRODUCTS } from '../src/lib/products'

const prisma = new PrismaClient()

/**
 * Нормалізація текстового типу з масиву у значення enum ProductType.
 * Дозволяє зберігати в БД стандартизовані ключі (BAG, BACKPACK, SHOPPER, CASE, BELT_BAG),
 * а в UI вже робити локалізацію назв.
 */
function toProductType(raw?: string | null): ProductType {
  const s = (raw || '').trim().toLowerCase()

  const map: Record<string, ProductType> = {
    // англійські
    bag: 'BAG',
    backpack: 'BACKPACK',
    shopper: 'SHOPPER',
    tote: 'SHOPPER',
    case: 'CASE',

    // українські
    сумка: 'BAG',
    рюкзак: 'BACKPACK',
    шопер: 'SHOPPER',
    чохол: 'CASE',
  }

  return map[s] ?? 'BAG'
}

async function main() {
  console.log('Seeding products…')

  for (const p of PRODUCTS) {
    // 1) product upsert
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description ?? null,
        type: toProductType((p as any).type ?? null),
        basePriceUAH: p.basePriceUAH ?? null,
        inStock: p.inStock ?? true,

        variants: {
          deleteMany: {}, // очистити всі варіанти продукту
          create: (p.variants ?? []).map((v) => ({
            sku: v.sku ?? null,
            color: v.color ?? null,
            hex: v.hex ?? null,
            image: v.image ?? null,
            inStock: v.inStock ?? true,
            priceUAH: (v as any).priceUAH ?? null,
          })),
        },
      },
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description ?? null,
        type: toProductType((p as any).type ?? null),
        basePriceUAH: p.basePriceUAH ?? null,
        inStock: p.inStock ?? true,
        variants: {
          create: (p.variants ?? []).map((v) => ({
            sku: v.sku ?? null,
            color: v.color ?? null,
            hex: v.hex ?? null,
            image: v.image ?? null,
            inStock: v.inStock ?? true,
            priceUAH: (v as any).priceUAH ?? null,
          })),
        },
      },
      include: { variants: true },
    })

    console.log(
      'Upserted:',
      product.slug,
      `(${product.variants.length} variants)`
    )
  }

  console.log('Seed DONE')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
