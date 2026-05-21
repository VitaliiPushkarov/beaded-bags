'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import type {
  HomeHeroBannerSettingsDTO,
  HomeHeroSlideDTO,
} from '@/lib/home-hero-banner'

type Props = {
  initial: HomeHeroBannerSettingsDTO
}

type Values = HomeHeroBannerSettingsDTO

type UploadTarget = {
  slideId: string
  device: 'desktop' | 'mobile'
}

function createSlideId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `home-hero-slide-${Date.now()}`
}

function createBlankSlide(sort: number): HomeHeroSlideDTO {
  return {
    id: createSlideId(),
    desktopImage: '/img/hero-block-01.jpg',
    mobileImage: '/img/hero-block-m.jpg',
    linkHref: '/shop',
    desktopAlt: 'Gerdan Hero',
    mobileAlt: 'Gerdan Hero Mobile',
    sort,
    isActive: true,
  }
}

export default function HomeHeroForm({ initial }: Props) {
  const [values, setValues] = useState<Values>(initial)
  const [savedValues, setSavedValues] = useState<Values>(initial)
  const [saving, setSaving] = useState(false)
  const [uploadingTarget, setUploadingTarget] = useState<UploadTarget | null>(
    null,
  )
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const slides = useMemo(
    () =>
      [...(values.slides || [])].sort(
        (a, b) => a.sort - b.sort || a.id.localeCompare(b.id),
      ),
    [values.slides],
  )

  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(savedValues),
    [savedValues, values],
  )

  async function uploadToCloudinary(file: File): Promise<string> {
    const sigRes = await fetch('/api/admin/cloudinary/signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'gerdan/home-hero' }),
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

  function updateSlide(slideId: string, patch: Partial<HomeHeroSlideDTO>) {
    setValues((prev) => ({
      ...prev,
      slides: (prev.slides || []).map((slide) =>
        slide.id === slideId ? { ...slide, ...patch } : slide,
      ),
    }))
  }

  function removeSlide(slideId: string) {
    setValues((prev) => {
      const next = (prev.slides || []).filter((slide) => slide.id !== slideId)
      if (next.length === 0) {
        return {
          ...prev,
          slides: [createBlankSlide(1)],
        }
      }
      return {
        ...prev,
        slides: next,
      }
    })
  }

  function addSlide() {
    setValues((prev) => ({
      ...prev,
      slides: [...(prev.slides || []), createBlankSlide((prev.slides || []).length + 1)],
    }))
  }

  async function onPickFile(
    event: ChangeEvent<HTMLInputElement>,
    slideId: string,
    device: 'desktop' | 'mobile',
  ) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setSuccess(null)
      setError(null)
      setUploadingTarget({ slideId, device })

      const url = await uploadToCloudinary(file)
      updateSlide(slideId, {
        [device === 'desktop' ? 'desktopImage' : 'mobileImage']: url,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка завантаження')
    } finally {
      setUploadingTarget(null)
      event.target.value = ''
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setSuccess(null)
      setError(null)

      const payload: HomeHeroBannerSettingsDTO = {
        slides: slides.map((slide, index) => ({
          ...slide,
          sort: Number.isFinite(Number(slide.sort))
            ? Math.max(0, Math.round(Number(slide.sort)))
            : index + 1,
          isActive: slide.isActive !== false,
        })),
      }

      const res = await fetch('/api/admin/home-hero', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const responsePayload = (await res.json().catch(() => ({}))) as {
        error?: string | { fieldErrors?: Record<string, string[]> }
        settings?: HomeHeroBannerSettingsDTO
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

        setError('Не вдалося зберегти слайдер')
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
        <h1 className="text-2xl font-semibold">HeroBlock слайдер на головній</h1>
        <button
          type="button"
          onClick={addSlide}
          className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Додати слайд
        </button>
      </div>

      <div className="space-y-6">
        {slides.map((slide, index) => {
          const desktopUploadId = `home-hero-desktop-upload-${slide.id}`
          const mobileUploadId = `home-hero-mobile-upload-${slide.id}`

          return (
            <div key={slide.id} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-800">Слайд #{index + 1}</div>
                <button
                  type="button"
                  onClick={() => removeSlide(slide.id)}
                  className="cursor-pointer rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                  disabled={slides.length <= 1}
                >
                  Видалити
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="block text-sm font-medium text-slate-800">
                  <div>Desktop банер (URL)</div>
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={slide.desktopImage}
                    onChange={(e) => updateSlide(slide.id, { desktopImage: e.target.value })}
                    placeholder="/img/hero-block-01.jpg або https://..."
                    required
                  />
                  <label
                    htmlFor={desktopUploadId}
                    className="mt-2 w-full sm:w-auto inline-flex items-center justify-center px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 bg-blue-700 text-white hover:text-black cursor-pointer"
                  >
                    Вибрати файл
                  </label>
                  <input
                    id={desktopUploadId}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => onPickFile(e, slide.id, 'desktop')}
                  />
                  {uploadingTarget?.slideId === slide.id &&
                  uploadingTarget.device === 'desktop' ? (
                    <span className="mt-1 inline-block text-xs text-slate-500">
                      Завантажую...
                    </span>
                  ) : null}
                </div>

                <div className="block text-sm font-medium text-slate-800">
                  <div>Mobile банер (URL)</div>
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={slide.mobileImage}
                    onChange={(e) => updateSlide(slide.id, { mobileImage: e.target.value })}
                    placeholder="/img/hero-block-m.jpg або https://..."
                    required
                  />
                  <label
                    htmlFor={mobileUploadId}
                    className="mt-2 w-full sm:w-auto inline-flex items-center justify-center px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 bg-blue-700 text-white hover:text-black cursor-pointer"
                  >
                    Вибрати файл
                  </label>
                  <input
                    id={mobileUploadId}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => onPickFile(e, slide.id, 'mobile')}
                  />
                  {uploadingTarget?.slideId === slide.id &&
                  uploadingTarget.device === 'mobile' ? (
                    <span className="mt-1 inline-block text-xs text-slate-500">
                      Завантажую...
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <label className="block text-sm font-medium text-slate-800">
                  Посилання при кліку
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={slide.linkHref}
                    onChange={(e) => updateSlide(slide.id, { linkHref: e.target.value })}
                    placeholder="/shop"
                    required
                  />
                </label>

                <label className="block text-sm font-medium text-slate-800">
                  ALT desktop
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={slide.desktopAlt}
                    onChange={(e) => updateSlide(slide.id, { desktopAlt: e.target.value })}
                    required
                  />
                </label>

                <label className="block text-sm font-medium text-slate-800">
                  ALT mobile
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={slide.mobileAlt}
                    onChange={(e) => updateSlide(slide.id, { mobileAlt: e.target.value })}
                    required
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <label className="block text-sm font-medium text-slate-800">
                  Позиція
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    inputMode="numeric"
                    value={String(slide.sort)}
                    onChange={(e) =>
                      updateSlide(slide.id, {
                        sort: Number(e.target.value.replace(/[^\d]/g, '')) || 0,
                      })
                    }
                  />
                </label>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 pt-8">
                  <input
                    type="checkbox"
                    checked={slide.isActive}
                    onChange={(e) => updateSlide(slide.id, { isActive: e.target.checked })}
                  />
                  Активний слайд
                </label>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                    Preview Desktop
                  </div>
                  <Image
                    src={slide.desktopImage}
                    alt={slide.desktopAlt}
                    width={1400}
                    height={900}
                    className="h-56 w-full rounded-md object-cover"
                  />
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                    Preview Mobile
                  </div>
                  <Image
                    src={slide.mobileImage}
                    alt={slide.mobileAlt}
                    width={900}
                    height={1400}
                    className="h-56 w-full rounded-md object-cover"
                  />
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
          disabled={saving || uploadingTarget !== null}
          className="cursor-pointer rounded-md border-black border-1 bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 hover:bg-white hover:text-black"
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
