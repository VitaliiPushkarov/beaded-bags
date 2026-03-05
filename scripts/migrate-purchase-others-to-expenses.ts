import { ExpenseCategory, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MIGRATION_MARKER_PREFIX = '[migrate:purchase-item='

type Candidate = {
  id: string
  title: string
  totalUAH: number
  purchaseId: string
  purchasedAt: Date
  supplierName: string
  purchaseNotes: string | null
}

function hasApplyFlag(argv: string[]): boolean {
  return argv.includes('--apply')
}

function extractCategoryPrefix(title: string): string {
  return title.split('|')[0]?.trim().toLowerCase() ?? ''
}

function isOtherCategoryTitle(title: string): boolean {
  const prefix = extractCategoryPrefix(title)
  return prefix === 'інше' || prefix === 'інші' || prefix === 'other'
}

function buildMarker(purchaseItemId: string): string {
  return `${MIGRATION_MARKER_PREFIX}${purchaseItemId}]`
}

function parseMigratedMarker(notes: string | null): string | null {
  if (!notes) return null
  const match = notes.match(/\[migrate:purchase-item=([^\]]+)\]/)
  return match?.[1] ?? null
}

function buildExpenseTitle(title: string): string {
  const parts = title
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length >= 2 && isOtherCategoryTitle(parts[0])) {
    return parts.slice(1).join(' | ')
  }

  return title
}

async function run() {
  const apply = hasApplyFlag(process.argv.slice(2))

  const purchaseItems = await prisma.purchaseItem.findMany({
    include: {
      purchase: {
        include: {
          supplier: {
            select: { name: true },
          },
        },
      },
    },
  })

  const candidates: Candidate[] = purchaseItems
    .filter((item) => isOtherCategoryTitle(item.title))
    .map((item) => ({
      id: item.id,
      title: item.title,
      totalUAH: item.totalUAH,
      purchaseId: item.purchaseId,
      purchasedAt: item.purchase.purchasedAt,
      supplierName: item.purchase.supplier.name,
      purchaseNotes: item.purchase.notes,
    }))

  if (candidates.length === 0) {
    console.info('No purchase items with category "other" were found.')
    return
  }

  const alreadyMigratedExpenses = await prisma.expense.findMany({
    where: {
      category: ExpenseCategory.OTHER,
      notes: {
        contains: MIGRATION_MARKER_PREFIX,
      },
    },
    select: {
      notes: true,
    },
  })

  const migratedPurchaseItemIds = new Set(
    alreadyMigratedExpenses
      .map((expense) => parseMigratedMarker(expense.notes))
      .filter((value): value is string => Boolean(value)),
  )

  const totalAmount = candidates.reduce((sum, item) => sum + item.totalUAH, 0)
  const alreadyMigratedCount = candidates.filter((item) =>
    migratedPurchaseItemIds.has(item.id),
  ).length
  const toCreateExpenses = candidates.length - alreadyMigratedCount

  console.info('Purchase -> Expense migration summary:')
  console.info(`- mode: ${apply ? 'APPLY' : 'DRY-RUN'}`)
  console.info(`- candidates: ${candidates.length}`)
  console.info(`- total amount: ${totalAmount} UAH`)
  console.info(`- expense records to create: ${toCreateExpenses}`)
  console.info(`- already migrated expense markers: ${alreadyMigratedCount}`)

  if (!apply) {
    console.info('Dry run completed. Use --apply to execute migration.')
    return
  }

  await prisma.$transaction(async (tx) => {
    const affectedPurchaseIds = new Set<string>()

    for (const candidate of candidates) {
      affectedPurchaseIds.add(candidate.purchaseId)

      if (!migratedPurchaseItemIds.has(candidate.id)) {
        await tx.expense.create({
          data: {
            category: ExpenseCategory.OTHER,
            title: buildExpenseTitle(candidate.title),
            amountUAH: candidate.totalUAH,
            expenseDate: candidate.purchasedAt,
            notes: [
              buildMarker(candidate.id),
              `source=PurchaseItem`,
              `purchaseId=${candidate.purchaseId}`,
              `supplier=${candidate.supplierName}`,
              `originalTitle=${candidate.title}`,
              candidate.purchaseNotes
                ? `purchaseNotes=${candidate.purchaseNotes}`
                : null,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        })
      }

      await tx.purchaseItem.delete({
        where: { id: candidate.id },
      })
    }

    for (const purchaseId of affectedPurchaseIds) {
      const aggregate = await tx.purchaseItem.aggregate({
        where: { purchaseId },
        _sum: { totalUAH: true },
      })
      const purchase = await tx.purchase.findUnique({
        where: { id: purchaseId },
        select: { deliveryUAH: true },
      })
      if (!purchase) continue

      const subtotalUAH = aggregate._sum.totalUAH ?? 0
      await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          subtotalUAH,
          totalUAH: subtotalUAH + purchase.deliveryUAH,
        },
      })
    }
  })

  console.info('Migration completed successfully.')
}

run()
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
