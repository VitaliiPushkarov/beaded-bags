import { revalidatePath } from 'next/cache'

import LiqPayFiscalAudit, {
  type FiscalRecheckState,
} from '@/components/admin/LiqPayFiscalAudit'
import LiqPaySyncPanel, {
  type LiqPayImportState,
} from '@/components/admin/LiqPaySyncPanel'
import {
  findUnmappedLiqPayEntities,
  generateLiqPayCatalogFileContent,
  importLiqPayMappingFromWorkbooks,
} from '@/lib/liqpay-catalog-sync'
import {
  loadLiqPayFiscalAudit,
  recheckLiqPayFiscalStatuses,
} from '@/lib/liqpay-fiscal-audit'
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
    // The ПРРО cabinet exports one file per category, so a sync is normally
    // several files at once rather than one.
    const files = formData
      .getAll('file')
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)

    if (files.length === 0) {
      return {
        status: 'error',
        message: 'Оберіть файл(и) каталогу, експортовані з LiqPay.',
      }
    }

    try {
      // All files in one batch, so an item claimed from one category cannot be
      // quietly re-claimed from another.
      const { imported, skipped, unmatched, corrected } =
        await importLiqPayMappingFromWorkbooks(
          await Promise.all(files.map((file) => file.arrayBuffer())),
        )

      const duplicateCount = unmatched.filter(
        (good) => good.reason === 'duplicate',
      ).length
      const unknownCount = unmatched.length - duplicateCount

      revalidatePath('/admin/liqpay')
      return {
        status: 'success',
        imported,
        skipped,
        unmatched,
        corrected,
        message:
          `Файлів: ${files.length}. Звʼязано товарів: ${imported}.` +
          (corrected.length
            ? ` Виправлено хибних ID: ${corrected.length}.`
            : '') +
          (duplicateCount
            ? ` Дублікатів у ПРРО: ${duplicateCount} — їх треба видалити в кабінеті.`
            : '') +
          (unknownCount
            ? ` Без відповідника в магазині: ${unknownCount}.`
            : '') +
          (unmatched.length === 0 ? ' Усі рядки звʼязано.' : ''),
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

  async function recheckFiscalAction(): Promise<FiscalRecheckState> {
    'use server'
    try {
      const result = await recheckLiqPayFiscalStatuses({ alert: false })
      revalidatePath('/admin/liqpay')

      if (result.checked === 0) {
        return {
          status: 'success',
          message: 'Усі оплачені замовлення вже мають фіскальний чек.',
        }
      }

      return {
        status: 'success',
        message:
          `Перевірено ${result.checked}. ` +
          `Зʼявився чек: ${result.fiscalized}. Досі без чека: ${result.stillFailing}.`,
      }
    } catch (error) {
      console.error('[liqpay:fiscal] recheck failed', error)
      return {
        status: 'error',
        message: 'Не вдалося звернутися до LiqPay. Спробуйте ще раз.',
      }
    }
  }

  const [mappingCount, lastSynced, unmapped, fiscalRows] = await Promise.all([
    prisma.liqPayCatalogMapping.count(),
    prisma.liqPayCatalogMapping.findFirst({
      orderBy: { syncedAt: 'desc' },
      select: { syncedAt: true },
    }),
    findUnmappedLiqPayEntities(),
    loadLiqPayFiscalAudit(),
  ])

  return (
    <div className="space-y-6">
      <LiqPaySyncPanel
        downloadAction={downloadCatalogAction}
        importAction={importMappingAction}
        mappingCount={mappingCount}
        lastSyncedAt={lastSynced?.syncedAt ?? null}
        unmappedItems={unmapped.items}
        checkedCount={unmapped.checkedCount}
      />
      <LiqPayFiscalAudit rows={fiscalRows} recheckAction={recheckFiscalAction} />
    </div>
  )
}
