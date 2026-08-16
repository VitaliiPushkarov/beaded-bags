'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import type {
  HomeCategoryCardDTO,
  HomeCategoryCardsSettingsDTO,
} from '@/lib/home-page-config'

type Props = {
  initial: HomeCategoryCardsSettingsDTO
}

function createCardId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `home-category-card-${Date.now()}`
}

function createBlankCard(sort: number): HomeCategoryCardDTO {
  return {
    id: createCardId(),
    title: 'Нова категорія',
    titleEn: 'New Category',
    href: '/shop',
    image: '/img/placeholder.png',
    subtitle: 'Короткий опис категорії',
    subtitleEn: 'Short category description',
    sort,
    isActive: true,
  }
}

export default function CategoryCardsForm({ initial }: Props) {
  const [values, setValues] = useState<HomeCategoryCardsSettingsDTO>(initial)
  const [savedValues, setSavedValues] =
    useState<HomeCategoryCardsSettingsDTO>(initial)
  const [saving, setSaving] = useState(false)
  const [uploadingCardId, setUploadingCardId] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cards = useMemo(
    () =>
      [...(values.cards || [])].sort(
        (a, b) => a.sort - b.sort || a.id.localeCompare(b.id),
      ),
    [values.cards],
  )

  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(savedValues),
    [savedValues, values],
  )

  async function uploadToCloudinary(file: File): Promise<string> {
    const sigRes = await fetch('/api/admin/cloudinary/signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'gerdan/category-cards' }),
    })

    if (!sigRes.ok) {
      throw new Error('Не вдалося отримати підпис для завантаження')
    }

    const sig = (await sigRes.json()) as {
      cloudName: string
      apiKey: string
      timestamp: number
      folder: string
      signature: string
    }

    const form = new FormData()
    form.append('file', file)
    form.append('api_key', sig.apiKey)
    form.append('timestamp', String(sig.timestamp))
    form.append('signature', sig.signature)
    form.append('folder', sig.folder)

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
      { method: 'POST', body: form },
    )

    const uploadJson = (await uploadRes.json()) as {
      secure_url?: string
      error?: { message?: string }
    }

    if (!uploadRes.ok || !uploadJson.secure_url) {
      throw new Error(uploadJson.error?.message || 'Помилка завантаження')
    }

    return uploadJson.secure_url
  }

  function updateCard(cardId: string, patch: Partial<HomeCategoryCardDTO>) {
    setValues((prev) => ({
      ...prev,
      cards: (prev.cards || []).map((card) =>
        card.id === cardId ? { ...card, ...patch } : card,
      ),
    }))
  }

  function removeCard(cardId: string) {
    setValues((prev) => {
      const next = (prev.cards || []).filter((card) => card.id !== cardId)
      if (next.length === 0) {
        return {
          ...prev,
          cards: [createBlankCard(1)],
        }
      }

      return {
        ...prev,
        cards: next,
      }
    })
  }

  function addCard() {
    setValues((prev) => ({
      ...prev,
      cards: [...(prev.cards || []), createBlankCard((prev.cards || []).length + 1)],
    }))
  }

  async function onPickFile(event: ChangeEvent<HTMLInputElement>, cardId: string) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setSuccess(null)
      setError(null)
      setUploadingCardId(cardId)

      const url = await uploadToCloudinary(file)
      updateCard(cardId, { image: url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка завантаження')
    } finally {
      setUploadingCardId(null)
      event.target.value = ''
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setSuccess(null)
      setError(null)

      const payload: HomeCategoryCardsSettingsDTO = {
        cards: cards.map((card, index) => ({
          ...card,
          sort: Number.isFinite(Number(card.sort))
            ? Math.max(0, Math.round(Number(card.sort)))
            : index + 1,
          isActive: card.isActive !== false,
        })),
      }

      const res = await fetch('/api/admin/category-cards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const responsePayload = (await res.json().catch(() => ({}))) as {
        error?: string | { fieldErrors?: Record<string, string[]> }
        settings?: HomeCategoryCardsSettingsDTO
      }

      if (!res.ok) {
        if (typeof responsePayload.error === 'string') {
          setError(responsePayload.error)
          return
        }

        const fields = responsePayload.error?.fieldErrors
        if (fields) {
          const firstMessage = Object.values(fields)
            .flat()
            .find((message) => !!message)
          setError(firstMessage || 'Некоректні дані форми')
          return
        }

        setError('Не вдалося зберегти картки категорій')
        return
      }

      const nextSettings = responsePayload.settings || payload
      setValues(nextSettings)
      setSavedValues(nextSettings)
      setSuccess('Зміни збережено')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Мережева помилка')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">CategorySection на головній</h2>
        <button
          type="button"
          onClick={addCard}
          className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Додати картку
        </button>
      </div>

      <div className="space-y-6">
        {cards.map((card, index) => {
          const uploadId = `category-card-upload-${card.id}`

          return (
            <div key={card.id} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-800">
                  Картка #{index + 1}
                </div>
                <button
                  type="button"
                  onClick={() => removeCard(card.id)}
                  className="cursor-pointer rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                  disabled={cards.length <= 1}
                >
                  Видалити
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm font-medium text-slate-800">
                  Назва
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={card.title}
                    onChange={(e) => updateCard(card.id, { title: e.target.value })}
                    required
                  />
                </label>

                <label className="block text-sm font-medium text-slate-800">
                  Назва EN
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={card.titleEn}
                    onChange={(e) =>
                      updateCard(card.id, { titleEn: e.target.value })
                    }
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <label className="block text-sm font-medium text-slate-800">
                  Підпис
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={card.subtitle}
                    onChange={(e) =>
                      updateCard(card.id, { subtitle: e.target.value })
                    }
                    required
                  />
                </label>

                <label className="block text-sm font-medium text-slate-800">
                  Підпис EN
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={card.subtitleEn}
                    onChange={(e) =>
                      updateCard(card.id, { subtitleEn: e.target.value })
                    }
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <label className="block text-sm font-medium text-slate-800">
                  Посилання
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={card.href}
                    onChange={(e) => updateCard(card.id, { href: e.target.value })}
                    required
                  />
                </label>

                <label className="block text-sm font-medium text-slate-800">
                  Позиція
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    inputMode="numeric"
                    value={String(card.sort)}
                    onChange={(e) =>
                      updateCard(card.id, {
                        sort: Number(e.target.value.replace(/[^\d]/g, '')) || 0,
                      })
                    }
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="block text-sm font-medium text-slate-800">
                  <div>Фото (URL)</div>
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={card.image}
                    onChange={(e) =>
                      updateCard(card.id, { image: e.target.value })
                    }
                    required
                  />
                  <label
                    htmlFor={uploadId}
                    className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-lg border bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
                  >
                    Завантажити фото
                  </label>
                  <input
                    id={uploadId}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => onPickFile(e, card.id)}
                  />
                  {uploadingCardId === card.id ? (
                    <span className="mt-1 inline-block text-xs text-slate-500">
                      Завантажую...
                    </span>
                  ) : null}
                </div>

                <div>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={card.isActive}
                      onChange={(e) =>
                        updateCard(card.id, { isActive: e.target.checked })
                      }
                    />
                    Активна картка
                  </label>

                  <div className="mt-4 rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                      Preview
                    </div>
                    <Image
                      src={card.image}
                      alt={card.title}
                      width={900}
                      height={1200}
                      className="h-64 w-full rounded-md object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || uploadingCardId !== null}
          className="cursor-pointer rounded-md border border-black bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Зберігаю...' : 'Зберегти'}
        </button>

        {!isDirty ? (
          <span className="text-xs text-slate-500">Змін немає</span>
        ) : (
          <span className="text-xs text-amber-600">Є незбережені зміни</span>
        )}
      </div>
    </form>
  )
}
