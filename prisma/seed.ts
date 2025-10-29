import { PrismaClient } from '@prisma/client'
import { PRODUCTS } from '@/lib/products'

const prisma = new PrismaClient()

async function main() {
  for (const p of PRODUCTS) {
    const created = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description ?? null,
        type: 'BAG', // або як у твоїй логіці
        basePriceUAH: p.basePriceUAH ?? null,
        inStock: p.inStock ?? true,
        variants: {
          create: (p.variants ?? []).map((v) => ({
            sku: v.sku ?? null,
            color: v.color ?? null,
            hex: v.hex ?? null,
            image: v.image ?? null,
            inStock: v.inStock ?? true,
            priceUAH: v.priceUAH ?? null,
          })),
        },
      },
    })
    console.log('Upserted', created.slug)
  }
}

main().finally(() => prisma.$disconnect())
