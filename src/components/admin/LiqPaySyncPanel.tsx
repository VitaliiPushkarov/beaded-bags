'use client'

import { useActionState, useState } from 'react'

import type { UnmappedLiqPayEntity } from '@/lib/liqpay-catalog-sync'

export type LiqPayImportState =
  | { status: 'idle' }
  | { status: 'success'; imported: number; skipped: number; message: string }
  | { status: 'error'; message: string }

type Props = {
  downloadAction: () => Promise<{ content: string; filename: string }>
  importAction: (
    prev: LiqPayImportState,
    formData: FormData,
  ) => Promise<LiqPayImportState>
  mappingCount: number
  lastSyncedAt: Date | null
  unmappedItems: UnmappedLiqPayEntity[]
  checkedCount: number
}

function groupByProduct(items: UnmappedLiqPayEntity[]) {
  const map = new Map<string, UnmappedLiqPayEntity[]>()
  for (const item of items) {
    const list = map.get(item.productName) ?? []
    list.push(item)
    map.set(item.productName, list)
  }
  return Array.from(map, ([productName, entries]) => ({ productName, entries }))
}

function formatDateTime(value: Date | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}

export default function LiqPaySyncPanel({
  downloadAction,
  importAction,
  mappingCount,
  lastSyncedAt,
  unmappedItems,
  checkedCount,
}: Props) {
  const groupedUnmapped = groupByProduct(unmappedItems)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [importState, formAction, importing] = useActionState<
    LiqPayImportState,
    FormData
  >(importAction, { status: 'idle' })

  async function handleDownload() {
    setDownloading(true)
    setDownloadError(null)
    try {
      const { content, filename } = await downloadAction()
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      setDownloadError('Не вдалося згенерувати файл каталогу. Спробуйте ще раз.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Синхронізація з LiqPay</h1>
        <p className="text-sm text-gray-600">
          Каталог для фіскалізації чеків (ПРРО). Ціни на чеку беруться з
          замовлення, тож зміна ціни/акції не потребує повторної синхронізації —
          оновлюйте каталог лише коли додаєте нові товари, варіанти, ремінці,
          мішечки чи розміри.
        </p>
      </div>

      {/* Missing-mapping report */}
      {unmappedItems.length === 0 ? (
        <div
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          Усі позиції в наявності мають фіскальний ID LiqPay
          {checkedCount > 0 ? ` (перевірено ${checkedCount}).` : '.'} Нових
          товарів для додавання немає.
        </div>
      ) : (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          role="alert"
        >
          <p className="font-medium">
            {unmappedItems.length}{' '}
            {unmappedItems.length === 1 ? 'позиція' : 'позицій'} без LiqPay ID —
            їх треба додати в каталог LiqPay, інакше оплата онлайн для цих
            товарів не пройде.
          </p>
          <p className="mt-1 text-amber-800">
            Виконайте кроки нижче (експорт → додавання в кабінеті → імпорт), щоб
            присвоїти їм фіскальні ID.
          </p>
          <div className="mt-3 space-y-3">
            {groupedUnmapped.map((group) => (
              <div key={group.productName}>
                <div className="font-medium">{group.productName}</div>
                <ul className="mt-1 space-y-0.5">
                  {group.entries.map((entry) => (
                    <li
                      key={entry.externalCode}
                      className="flex flex-wrap items-baseline gap-x-2 text-amber-800"
                    >
                      <span>{entry.label}</span>
                      <code className="rounded bg-amber-100 px-1 text-xs">
                        {entry.externalCode}
                      </code>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <ol className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <li>1. Завантажте актуальний файл каталогу (кнопка нижче).</li>
        <li>
          2. Імпортуйте його в кабінеті LiqPay: «РРО» → «Товари» → імпорт файлу.
        </li>
        <li>
          3. Експортуйте товари назад з LiqPay (з присвоєними ID) у файл
          xlsx/csv.
        </li>
        <li>
          4. Завантажте цей файл нижче — відповідності «код → LiqPay ID»
          оновляться автоматично.
        </li>
      </ol>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Export */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-medium">1. Експорт каталогу</h2>
          <p className="mt-1 text-sm text-gray-600">
            Формує файл з опублікованих товарів у наявності для завантаження в
            кабінет LiqPay.
          </p>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="mt-4 inline-flex h-10 items-center justify-center rounded bg-black px-4 text-sm text-white transition hover:bg-[#FF3D8C] disabled:opacity-60 cursor-pointer"
          >
            {downloading ? 'Генеруємо…' : 'Завантажити файл каталогу'}
          </button>
          {downloadError && (
            <p className="mt-2 text-sm text-rose-600" role="alert">
              {downloadError}
            </p>
          )}
        </section>

        {/* Import mapping */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-medium">2. Імпорт відповідностей</h2>
          <p className="mt-1 text-sm text-gray-600">
            Завантажте експорт каталогу з LiqPay (xlsx або csv), щоб оновити
            відповідності товарів до фіскальних ID.
          </p>
          <form action={formAction} className="mt-4 space-y-3">
            <input
              type="file"
              name="file"
              accept=".xlsx,.xls,.csv"
              required
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-slate-700"
            />
            <button
              type="submit"
              disabled={importing}
              className="inline-flex h-10 items-center justify-center rounded border border-slate-300 px-4 text-sm transition hover:border-black disabled:opacity-60 cursor-pointer"
            >
              {importing ? 'Імпортуємо…' : 'Імпортувати відповідності'}
            </button>
          </form>
          {importState.status === 'success' && (
            <p className="mt-3 text-sm text-emerald-700" role="status">
              {importState.message}
            </p>
          )}
          {importState.status === 'error' && (
            <p className="mt-3 text-sm text-rose-600" role="alert">
              {importState.message}
            </p>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-slate-200 bg-white p-5 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Збережено відповідностей
          </div>
          <div className="text-lg font-semibold">{mappingCount}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Остання синхронізація
          </div>
          <div className="text-lg font-semibold">
            {formatDateTime(lastSyncedAt)}
          </div>
        </div>
      </div>
    </div>
  )
}
