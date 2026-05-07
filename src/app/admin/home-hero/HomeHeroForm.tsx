'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import type { HomeHeroBannerSettingsDTO } from '@/lib/home-hero-banner'

type Props = {
  initial: HomeHeroBannerSettingsDTO
}

type Values = HomeHeroBannerSettingsDTO

export default function HomeHeroForm({ initial }: Props) {
  const [values, setValues] = useState<Values>(initial)
  const [savedValues, setSavedValues] = useState<Values>(initial)
  const [saving, setSaving] = useState(false)
  const [uploadingTarget, setUploadingTarget] = useState<
    'desktop' | 'mobile' | null
  >(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  async function onPickFile(
    event: ChangeEvent<HTMLInputElement>,
    target: 'desktop' | 'mobile',
  ) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setSuccess(null)
      setError(null)
      setUploadingTarget(target)

      const url = await uploadToCloudinary(file)
      setValues((prev) => ({
        ...prev,
        [target === 'desktop' ? 'desktopImage' : 'mobileImage']: url,
      }))
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

      const res = await fetch('/api/admin/home-hero', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string | { fieldErrors?: Record<string, string[]> }
        settings?: HomeHeroBannerSettingsDTO
      }

      if (!res.ok) {
        if (typeof payload.error === 'string') {
          setError(payload.error)
          return
        }

        const fields = payload.error?.fieldErrors
        if (fields) {
          const firstMessage = Object.values(fields)
            .flat()
            .find((message) => !!message)
          setError(firstMessage || 'Некоректні дані форми')
          return
        }

        setError('Не вдалося зберегти банер')
        return
      }

      if (payload.settings) {
        setValues(payload.settings)
        setSavedValues(payload.settings)
      } else {
        setSavedValues(values)
      }
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
      <div>
        <h1 className="text-2xl font-semibold">HeroBlock на головній</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="block text-sm font-medium text-slate-800">
          <span>Desktop банер (URL)</span>
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={values.desktopImage}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, desktopImage: e.target.value }))
            }
            placeholder="/img/hero-block-01.jpg або https://..."
            required
          />
          <label
            htmlFor="home-hero-desktop-upload"
            className="mt-2 w-full sm:w-auto shrink-0 inline-flex items-center justify-center px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 bg-blue-700 text-white hover:text-black cursor-pointer"
          >
            Вибрати файл
          </label>
          <input
            id="home-hero-desktop-upload"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onPickFile(e, 'desktop')}
          />
          {uploadingTarget === 'desktop' ? (
            <span className="mt-1 inline-block text-xs text-slate-500">
              Завантажую...
            </span>
          ) : null}
        </div>

        <div className="block text-sm font-medium text-slate-800">
          <span>Mobile банер (URL)</span>
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={values.mobileImage}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, mobileImage: e.target.value }))
            }
            placeholder="/img/hero-block-m.jpg або https://..."
            required
          />
          <label
            htmlFor="home-hero-mobile-upload"
            className="mt-2 w-full sm:w-auto shrink-0 inline-flex items-center justify-center px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 bg-blue-700 text-white hover:text-black cursor-pointer"
          >
            Вибрати файл
          </label>
          <input
            id="home-hero-mobile-upload"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onPickFile(e, 'mobile')}
          />
          {uploadingTarget === 'mobile' ? (
            <span className="mt-1 inline-block text-xs text-slate-500">
              Завантажую...
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <label className="block text-sm font-medium text-slate-800">
          Посилання при кліку
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={values.linkHref}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, linkHref: e.target.value }))
            }
            placeholder="/shop"
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-800">
          ALT desktop
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={values.desktopAlt}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, desktopAlt: e.target.value }))
            }
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-800">
          ALT mobile
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={values.mobileAlt}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, mobileAlt: e.target.value }))
            }
            required
          />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
            Preview Desktop
          </div>
          <Image
            src={values.desktopImage}
            alt={values.desktopAlt}
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
            src={values.mobileImage}
            alt={values.mobileAlt}
            width={900}
            height={1400}
            className="h-56 w-full rounded-md object-cover"
          />
        </div>
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
