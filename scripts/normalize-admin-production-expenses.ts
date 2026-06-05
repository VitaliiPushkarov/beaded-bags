import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ADMIN_PRODUCTION_NOTES_MARKER = 'Оплата роботи майстра (admin production)'

function hasApplyFlag(argv: string[]): boolean {
  return argv.includes('--apply')
}

function normalizeExpenseTitle(title: string): string {
  return title.replace(/,\s*\d+\s*шт,\s*\d+₴\/шт$/u, '')
}

async function run() {
  const apply = hasApplyFlag(process.argv.slice(2))

  const expenses = await prisma.expense.findMany({
    where: {
      adminSettlements: {
        some: {},
      },
    },
    select: {
      id: true,
      title: true,
      notes: true,
    },
  })

  const updates = expenses
    .map((expense) => {
      const nextTitle = normalizeExpenseTitle(expense.title)
      const nextNotes = expense.notes?.includes(ADMIN_PRODUCTION_NOTES_MARKER)
        ? null
        : expense.notes

      const changed =
        nextTitle !== expense.title || nextNotes !== expense.notes

      return changed
        ? {
            id: expense.id,
            title: expense.title,
            nextTitle,
            notes: expense.notes,
            nextNotes,
          }
        : null
    })
    .filter((expense) => expense !== null)

  console.info('Admin production expense normalization:')
  console.info(`- mode: ${apply ? 'APPLY' : 'DRY-RUN'}`)
  console.info(`- candidate expenses: ${expenses.length}`)
  console.info(`- expenses to update: ${updates.length}`)

  if (updates.length > 0) {
    const preview = updates.slice(0, 5)

    for (const expense of preview) {
      console.info(`- ${expense.id}`)
      console.info(`  title: ${expense.title}`)
      console.info(`  nextTitle: ${expense.nextTitle}`)
      console.info(`  clearNotes: ${expense.notes !== expense.nextNotes}`)
    }

    if (updates.length > preview.length) {
      console.info(`- ...and ${updates.length - preview.length} more`)
    }
  }

  if (!apply) {
    console.info('Dry run completed. Use --apply to execute normalization.')
    return
  }

  for (const expense of updates) {
    await prisma.expense.update({
      where: { id: expense.id },
      data: {
        title: expense.nextTitle,
        notes: expense.nextNotes,
      },
    })
  }

  console.info('Normalization completed successfully.')
}

run()
  .catch((error) => {
    console.error('Normalization failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
