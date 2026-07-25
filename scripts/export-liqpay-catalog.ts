import { prisma } from '../src/lib/prisma'
import { generateLiqPayCatalogFileContent } from '../src/lib/liqpay-catalog-sync'

async function main() {
  const content = await generateLiqPayCatalogFileContent()
  console.log(content)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
