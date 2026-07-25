import { revalidatePath } from 'next/cache'

import LiqPaySyncPanel, {
  type LiqPayImportState,
} from '@/components/admin/LiqPaySyncPanel'
import {
  findUnmappedLiqPayEntities,
  generateLiqPayCatalogFileContent,
  importLiqPayMappingFromWorkbook,
} from '@/lib/liqpay-catalog-sync'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AdminLiqPayPage() {
  async function downloadCatalogAction() {
    'use server'
    const content = await generateLiqPayCatalogFileContent()
    const stamp = new Date().toISOString().slice(0, 10)
    return { content, filename: `liqpay-catalog-${stamp}.csv` }
  }

  async function importMappingAction(
    _prev: LiqPayImportState,
    formData: FormData,
  ): Promise<LiqPayImportState> {
    'use server'
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return {
        status: 'error',
        message: 'Оберіть файл каталогу, експортований з LiqPay.',
      }
    }

    try {
      const buffer = await file.arrayBuffer()
      const result = await importLiqPayMappingFromWorkbook(buffer)
      revalidatePath('/admin/liqpay')
      return {
        status: 'success',
        imported: result.imported,
        skipped: result.skipped,
        message: `Оновлено відповідностей: ${result.imported}. Пропущено рядків: ${result.skipped}.`,
      }
    } catch (error) {
      console.error('[liqpay:mapping] admin import failed', error)
      return {
        status: 'error',
        message:
          'Не вдалося обробити файл. Переконайтесь, що це експорт каталогу LiqPay (xlsx або csv).',
      }
    }
  }

  const [mappingCount, lastSynced, unmapped] = await Promise.all([
    prisma.liqPayCatalogMapping.count(),
    prisma.liqPayCatalogMapping.findFirst({
      orderBy: { syncedAt: 'desc' },
      select: { syncedAt: true },
    }),
    findUnmappedLiqPayEntities(),
  ])

  return (
    <LiqPaySyncPanel
      downloadAction={downloadCatalogAction}
      importAction={importMappingAction}
      mappingCount={mappingCount}
      lastSyncedAt={lastSynced?.syncedAt ?? null}
      unmappedItems={unmapped.items}
      checkedCount={unmapped.checkedCount}
    />
  )
}
