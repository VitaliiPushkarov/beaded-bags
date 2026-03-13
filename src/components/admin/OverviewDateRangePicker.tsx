'use client'

import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type RangePreset = '7d' | '30d' | '90d' | 'mtd' | 'ytd' | 'custom'
type ComparePreset = 'none' | 'prev' | 'yoy' | 'custom'
type PickerTab = 'templates' | 'custom'

type Props = {
  initialPreset: RangePreset
  initialFrom: string
  initialTo: string
  initialComparePreset: ComparePreset
  initialCompareFrom: string
  initialCompareTo: string
}

type DateRange = {
  from: Date
  to: Date
}

const UKR_MONTHS_SHORT = [
  'Січ',
  'Лют',
  'Бер',
  'Кві',
  'Тра',
  'Чер',
  'Лип',
  'Сер',
  'Вер',
  'Жов',
  'Лис',
  'Гру',
]

function parseDateInput(raw: string): Date | null {
  if (!raw) return null
  const date = new Date(`${raw}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function subYears(date: Date, years: number): Date {
  const next = new Date(date)
  next.setFullYear(next.getFullYear() - years)
  return next
}

function getPreviousRange(currentRange: DateRange): DateRange {
  const durationMs = currentRange.to.getTime() - currentRange.from.getTime() + 1
  const prevTo = new Date(currentRange.from.getTime() - 1)
  const prevFrom = new Date(prevTo.getTime() - durationMs + 1)
  return { from: prevFrom, to: prevTo }
}

function resolveMainRange(input: {
  from: string
  to: string
  fallbackFrom: string
  fallbackTo: string
}): DateRange {
  const parsedFrom = parseDateInput(input.from) ?? parseDateInput(input.fallbackFrom)
  const parsedTo = parseDateInput(input.to) ?? parseDateInput(input.fallbackTo)
  const safeFrom = parsedFrom ?? new Date('2000-01-01T00:00:00')
  const safeTo = parsedTo ?? safeFrom

  const normalizedFrom = startOfDay(safeFrom)
  const normalizedTo = endOfDay(safeTo)
  if (normalizedFrom.getTime() <= normalizedTo.getTime()) {
    return { from: normalizedFrom, to: normalizedTo }
  }

  return {
    from: startOfDay(safeTo),
    to: endOfDay(safeFrom),
  }
}

function getPresetRange(preset: Exclude<RangePreset, 'custom'>, now: Date): DateRange {
  if (preset === '7d') {
    return {
      from: startOfDay(addDays(now, -6)),
      to: endOfDay(now),
    }
  }
  if (preset === '90d') {
    return {
      from: startOfDay(addDays(now, -89)),
      to: endOfDay(now),
    }
  }
  if (preset === 'mtd') {
    return {
      from: startOfMonth(now),
      to: endOfDay(now),
    }
  }
  if (preset === 'ytd') {
    return {
      from: startOfYear(now),
      to: endOfDay(now),
    }
  }

  return {
    from: startOfDay(addDays(now, -29)),
    to: endOfDay(now),
  }
}

function resolveCompareRange(input: {
  comparePreset: ComparePreset
  compareFrom: string
  compareTo: string
  mainRange: DateRange
}): DateRange | null {
  if (input.comparePreset === 'none') return null
  if (input.comparePreset === 'prev') return getPreviousRange(input.mainRange)
  if (input.comparePreset === 'yoy') {
    return {
      from: startOfDay(subYears(input.mainRange.from, 1)),
      to: endOfDay(subYears(input.mainRange.to, 1)),
    }
  }

  const parsedFrom = parseDateInput(input.compareFrom)
  const parsedTo = parseDateInput(input.compareTo)
  if (!parsedFrom || !parsedTo) return null

  const from = startOfDay(parsedFrom)
  const to = endOfDay(parsedTo)
  if (from.getTime() > to.getTime()) return null

  return { from, to }
}

function formatHeadlineRange(range: DateRange): string {
  const from = range.from
  const to = range.to

  const fromMonth = UKR_MONTHS_SHORT[from.getMonth()]
  const toMonth = UKR_MONTHS_SHORT[to.getMonth()]
  const fromDay = from.getDate()
  const toDay = to.getDate()
  const fromYear = from.getFullYear()
  const toYear = to.getFullYear()

  if (fromYear === toYear && from.getMonth() === to.getMonth()) {
    return `${fromMonth} ${fromDay} - ${toDay}, ${toYear}`
  }

  if (fromYear === toYear) {
    return `${fromMonth} ${fromDay} - ${toMonth} ${toDay}, ${toYear}`
  }

  return `${fromMonth} ${fromDay}, ${fromYear} - ${toMonth} ${toDay}, ${toYear}`
}

function getMainPresetLabel(preset: RangePreset): string {
  if (preset === '7d') return 'За останній тиждень'
  if (preset === '30d') return 'За останній місяць'
  if (preset === '90d') return 'За останні 90 днів'
  if (preset === 'mtd') return 'З початку місяця'
  if (preset === 'ytd') return 'З початку року'
  return 'Довільний діапазон'
}

function getCompareLabel(comparePreset: ComparePreset): string {
  if (comparePreset === 'prev') return 'Попередній період'
  if (comparePreset === 'yoy') return 'Попередній рік'
  if (comparePreset === 'custom') return 'Кастомний період'
  return 'Без порівняння'
}

function getInitialTab(preset: RangePreset): PickerTab {
  return preset === 'custom' ? 'custom' : 'templates'
}

function getDefaultTemplateKey(preset: RangePreset): string | null {
  if (preset === '7d') return 'last7'
  if (preset === '30d') return 'last30'
  if (preset === '90d') return 'last90'
  if (preset === 'mtd') return 'mtd'
  if (preset === 'ytd') return 'ytd'
  return null
}

export default function OverviewDateRangePicker({
  initialPreset,
  initialFrom,
  initialTo,
  initialComparePreset,
  initialCompareFrom,
  initialCompareTo,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<PickerTab>(getInitialTab(initialPreset))

  const [preset, setPreset] = useState<RangePreset>(initialPreset)
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)

  const [comparePreset, setComparePreset] =
    useState<ComparePreset>(initialComparePreset)
  const [compareFrom, setCompareFrom] = useState(initialCompareFrom)
  const [compareTo, setCompareTo] = useState(initialCompareTo)
  const [activeTemplateKey, setActiveTemplateKey] = useState<string | null>(
    getDefaultTemplateKey(initialPreset),
  )

  const mainRange = useMemo(
    () =>
      resolveMainRange({
        from,
        to,
        fallbackFrom: initialFrom,
        fallbackTo: initialTo,
      }),
    [from, to, initialFrom, initialTo],
  )
  const compareRange = useMemo(
    () =>
      resolveCompareRange({
        comparePreset,
        compareFrom,
        compareTo,
        mainRange,
      }),
    [comparePreset, compareFrom, compareTo, mainRange],
  )

  const summaryTitle = `${getMainPresetLabel(preset)} (${formatHeadlineRange(mainRange)})`
  const summarySubtitle =
    comparePreset === 'none'
      ? 'без порівняння'
      : compareRange
        ? `проти ${getCompareLabel(comparePreset)} (${formatHeadlineRange(compareRange)})`
        : `проти ${getCompareLabel(comparePreset)}`

  const applyTemplate = (key: string) => {
    const now = new Date()
    const today = startOfDay(now)
    const yesterday = startOfDay(addDays(now, -1))

    if (key === 'today') {
      setPreset('custom')
      setFrom(toDateInputValue(today))
      setTo(toDateInputValue(today))
    } else if (key === 'yesterday') {
      setPreset('custom')
      setFrom(toDateInputValue(yesterday))
      setTo(toDateInputValue(yesterday))
    } else if (key === 'last7') {
      const range = getPresetRange('7d', now)
      setPreset('7d')
      setFrom(toDateInputValue(range.from))
      setTo(toDateInputValue(range.to))
    } else if (key === 'prev7') {
      const end = addDays(today, -1)
      const start = addDays(end, -6)
      setPreset('custom')
      setFrom(toDateInputValue(start))
      setTo(toDateInputValue(end))
    } else if (key === 'last30') {
      const range = getPresetRange('30d', now)
      setPreset('30d')
      setFrom(toDateInputValue(range.from))
      setTo(toDateInputValue(range.to))
    } else if (key === 'last90') {
      const range = getPresetRange('90d', now)
      setPreset('90d')
      setFrom(toDateInputValue(range.from))
      setTo(toDateInputValue(range.to))
    } else if (key === 'prevMonth') {
      const previousMonthDate = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1,
      )
      const start = startOfMonth(previousMonthDate)
      const end = endOfMonth(previousMonthDate)
      setPreset('custom')
      setFrom(toDateInputValue(start))
      setTo(toDateInputValue(end))
    } else if (key === 'mtd') {
      const range = getPresetRange('mtd', now)
      setPreset('mtd')
      setFrom(toDateInputValue(range.from))
      setTo(toDateInputValue(range.to))
    } else if (key === 'ytd') {
      const range = getPresetRange('ytd', now)
      setPreset('ytd')
      setFrom(toDateInputValue(range.from))
      setTo(toDateInputValue(range.to))
    } else if (key === 'prevYear') {
      const year = today.getFullYear() - 1
      setPreset('custom')
      setFrom(`${year}-01-01`)
      setTo(`${year}-12-31`)
    }

    setActiveTemplateKey(key)
    setTab('templates')
  }

  const handleApply = () => {
    let nextPreset = preset
    let nextFrom = from
    let nextTo = to
    let nextComparePreset = comparePreset
    let nextCompareFrom = compareFrom
    let nextCompareTo = compareTo

    if (nextPreset === 'custom') {
      const parsedFrom = parseDateInput(nextFrom)
      const parsedTo = parseDateInput(nextTo)
      if (!parsedFrom || !parsedTo) {
        nextFrom = toDateInputValue(mainRange.from)
        nextTo = toDateInputValue(mainRange.to)
      } else if (parsedFrom.getTime() > parsedTo.getTime()) {
        nextFrom = toDateInputValue(parsedTo)
        nextTo = toDateInputValue(parsedFrom)
      }
    }

    if (nextComparePreset === 'custom') {
      const parsedCompareFrom = parseDateInput(nextCompareFrom)
      const parsedCompareTo = parseDateInput(nextCompareTo)
      if (!parsedCompareFrom || !parsedCompareTo) {
        nextComparePreset = 'none'
      } else if (parsedCompareFrom.getTime() > parsedCompareTo.getTime()) {
        nextCompareFrom = toDateInputValue(parsedCompareTo)
        nextCompareTo = toDateInputValue(parsedCompareFrom)
      }
    }

    const params = new URLSearchParams()
    params.set('preset', nextPreset)
    params.set('from', nextFrom)
    params.set('to', nextTo)
    params.set('comparePreset', nextComparePreset)

    if (nextComparePreset === 'custom') {
      params.set('compareFrom', nextCompareFrom)
      params.set('compareTo', nextCompareTo)
    }

    router.push(`/admin?${params.toString()}`)
    setOpen(false)
  }

  return (
    <section className="">
      <div className="relative">
        <div className="text-md font-medium text-slate-700">Проміжок часу:</div>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="cursor-pointer mt-3 flex gap-3 w-100% items-center justify-between rounded-xl border border-slate-400 bg-white px-5 py-4 text-left hover:border-slate-500 hover:bg-slate-100"
        >
          <div>
            <div className="text-md font-medium leading-tight text-slate-900 ">
              {summaryTitle}
            </div>
            <div className="mt-1 text-md text-slate-900 ">
              {summarySubtitle}
            </div>
          </div>
          <ChevronDown
            className={`h-8 w-8 shrink-0 text-slate-800 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open ? (
          <div className="absolute left-0 z-20 mt-2 w-100% rounded-xl border border-slate-300 bg-white shadow-xl">
            <div className="border-b px-4 py-5 text-center text-lg font-medium uppercase tracking-wide text-slate-500">
              Виберіть діапазон дат
            </div>

            <div className="grid grid-cols-2 border-b">
              <button
                type="button"
                onClick={() => setTab('templates')}
                className={`px-4 py-4 text-lg font-semibold sm:text-xl ${
                  tab === 'templates'
                    ? 'border-b-2 border-sky-600 text-slate-900'
                    : 'text-slate-500'
                }`}
              >
                Шаблони
              </button>
              <button
                type="button"
                onClick={() => setTab('custom')}
                className={`px-4 py-4 text-lg font-semibold sm:text-xl ${
                  tab === 'custom'
                    ? 'border-b-2 border-sky-600 text-slate-900'
                    : 'text-slate-500'
                }`}
              >
                Довільний
              </button>
            </div>

            {tab === 'templates' ? (
              <div className="grid grid-cols-2">
                {[
                  { key: 'today', label: 'Сьогодні' },
                  { key: 'yesterday', label: 'Вчора' },
                  { key: 'last7', label: 'За останній тиждень' },
                  { key: 'prev7', label: 'Минулий тиждень' },
                  { key: 'last30', label: 'За останній місяць' },
                  { key: 'last90', label: 'За останні 90 днів' },
                  { key: 'prevMonth', label: 'Минулий місяць' },
                  { key: 'mtd', label: 'З початку місяця' },
                  { key: 'ytd', label: 'З початку року' },
                  { key: 'prevYear', label: 'Минулий рік' },
                ].map((option) => {
                  const isActive = activeTemplateKey === option.key
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => applyTemplate(option.key)}
                      className={`min-h-20 border px-4 py-4 text-left text-base text-slate-500 hover:bg-slate-50 sm:px-5 sm:py-5 sm:text-lg ${
                        isActive ? 'text-slate-900' : ''
                      }`}
                    >
                      <span className="inline-flex items-center gap-3">
                        <span
                          className={`h-3 w-3 shrink-0 rounded-sm ${isActive ? 'bg-sky-600' : 'bg-transparent'}`}
                        />
                        {option.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-4">
                  <label className="flex-1 text-sm font-medium text-slate-500">
                    Від
                    <input
                      type="date"
                      value={from}
                      onChange={(event) => {
                        setPreset('custom')
                        setFrom(event.target.value)
                        setActiveTemplateKey(null)
                      }}
                      className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="pt-6 text-sm text-slate-500">до</div>
                  <label className="flex-1 text-sm font-medium text-slate-500">
                    До
                    <input
                      type="date"
                      value={to}
                      onChange={(event) => {
                        setPreset('custom')
                        setTo(event.target.value)
                        setActiveTemplateKey(null)
                      }}
                      className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="border-y px-4 py-5 text-center text-lg font-medium uppercase tracking-wide text-slate-500">
              Порівняти з
            </div>

            <div className="grid grid-cols-2 border-b">
              {[
                { key: 'prev', label: 'Попередній період' },
                { key: 'yoy', label: 'Попередній рік' },
                { key: 'custom', label: 'Кастомний період' },
                { key: 'none', label: 'Без порівняння' },
              ].map((option) => {
                const isActive = comparePreset === option.key
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() =>
                      setComparePreset(option.key as ComparePreset)
                    }
                    className={`min-h-20 border px-4 py-4 text-left text-base text-slate-500 hover:bg-slate-50 sm:px-5 sm:py-5 sm:text-lg ${
                      isActive ? 'text-slate-900' : ''
                    }`}
                  >
                    <span className="inline-flex items-center gap-3">
                      <span
                        className={`h-3 w-3 shrink-0 rounded-sm ${isActive ? 'bg-sky-600' : 'bg-transparent'}`}
                      />
                      {option.label}
                    </span>
                  </button>
                )
              })}
            </div>

            {comparePreset === 'custom' ? (
              <div className="border-b p-5 sm:p-6">
                <div className="flex items-center gap-4">
                  <label className="flex-1 text-sm font-medium text-slate-500">
                    Від
                    <input
                      type="date"
                      value={compareFrom}
                      onChange={(event) => setCompareFrom(event.target.value)}
                      className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="pt-6 text-sm text-slate-500">до</div>
                  <label className="flex-1 text-sm font-medium text-slate-500">
                    До
                    <input
                      type="date"
                      value={compareTo}
                      onChange={(event) => setCompareTo(event.target.value)}
                      className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-center p-4">
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex min-w-56 items-center justify-center rounded-lg bg-sky-700 px-6 py-3 text-lg font-medium text-white hover:bg-sky-800"
              >
                Оновити
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
