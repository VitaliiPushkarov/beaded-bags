'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import type { HeroImagesSettingsDTO } from '@/lib/home-page-config'

type Props = {
  initial: HeroImagesSettingsDTO
}

type UploadField = 'leftImg' | 'centerPoster' | 'rightImg' | 'centerVideo'

export default function HeroImagesForm({ initial }: Props) {
  const [values, setValues] = useState<HeroImagesSettingsDTO>(initial)
  const [savedValues, setSavedValues] = useState<HeroImagesSettingsDTO>(initial)
  const [saving, setSaving] = useState(false)
  const [uploadingField, setUploadingField] = useState<UploadField | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(savedValues),
    [savedValues, values],
  )

  async function uploadToCloudinary(
    file: File,
    resourceType: 'image' | 'video',
  ): Promise<string> {
    const sigRes = await fetch('/api/admin/cloudinary/signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'gerdan/home-media' }),
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
      `https://api.cloudinary.com/v1_1/${sig.cloudName}/${resourceType}/upload`,
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
    field: UploadField,
    resourceType: 'image' | 'video',
  ) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setSuccess(null)
      setError(null)
      setUploadingField(field)

      const url = await uploadToCloudinary(file, resourceType)
      setValues((prev) => ({ ...prev, [field]: url }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка завантаження')
    } finally {
      setUploadingField(null)
      event.target.value = ''
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setSuccess(null)
      setError(null)

      const res = await fetch('/api/admin/hero-images', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const responsePayload = (await res.json().catch(() => ({}))) as {
        error?: string | { fieldErrors?: Record<string, string[]> }
        settings?: HeroImagesSettingsDTO
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

        setError('Не вдалося зберегти HeroImages')
        return
      }

      const nextSettings = responsePayload.settings || values
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
      <div>
        <h2 className="text-2xl font-semibold">HeroImages на головній</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="block text-sm font-medium text-slate-800">
          <div>Ліве фото (URL)</div>
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={values.leftImg}
            onChange={(e) => setValues((prev) => ({ ...prev, leftImg: e.target.value }))}
            required
          />
          <label
            htmlFor="hero-images-left-upload"
            className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-lg border bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            Завантажити фото
          </label>
          <input
            id="hero-images-left-upload"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onPickFile(e, 'leftImg', 'image')}
          />
          {uploadingField === 'leftImg' ? (
            <span className="mt-1 inline-block text-xs text-slate-500">Завантажую...</span>
          ) : null}
        </div>

        <div className="block text-sm font-medium text-slate-800">
          <div>Праве фото (URL)</div>
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={values.rightImg}
            onChange={(e) => setValues((prev) => ({ ...prev, rightImg: e.target.value }))}
            required
          />
          <label
            htmlFor="hero-images-right-upload"
            className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-lg border bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            Завантажити фото
          </label>
          <input
            id="hero-images-right-upload"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onPickFile(e, 'rightImg', 'image')}
          />
          {uploadingField === 'rightImg' ? (
            <span className="mt-1 inline-block text-xs text-slate-500">Завантажую...</span>
          ) : null}
        </div>

        <div className="block text-sm font-medium text-slate-800">
          <div>Центральне відео (URL)</div>
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={values.centerVideo}
            onChange={(e) => setValues((prev) => ({ ...prev, centerVideo: e.target.value }))}
            required
          />
          <label
            htmlFor="hero-images-video-upload"
            className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-lg border bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            Завантажити відео
          </label>
          <input
            id="hero-images-video-upload"
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(e) => onPickFile(e, 'centerVideo', 'video')}
          />
          {uploadingField === 'centerVideo' ? (
            <span className="mt-1 inline-block text-xs text-slate-500">Завантажую...</span>
          ) : null}
        </div>

        <div className="block text-sm font-medium text-slate-800">
          <div>Постер відео (URL)</div>
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={values.centerPoster}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, centerPoster: e.target.value }))
            }
            required
          />
          <label
            htmlFor="hero-images-poster-upload"
            className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-lg border bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            Завантажити фото
          </label>
          <input
            id="hero-images-poster-upload"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onPickFile(e, 'centerPoster', 'image')}
          />
          {uploadingField === 'centerPoster' ? (
            <span className="mt-1 inline-block text-xs text-slate-500">Завантажую...</span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block text-sm font-medium text-slate-800">
          ALT лівого фото
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={values.altLeft}
            onChange={(e) => setValues((prev) => ({ ...prev, altLeft: e.target.value }))}
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-800">
          ALT правого фото
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={values.altRight}
            onChange={(e) => setValues((prev) => ({ ...prev, altRight: e.target.value }))}
            required
          />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Ліве фото</div>
          <Image
            src={values.leftImg}
            alt={values.altLeft}
            width={600}
            height={800}
            className="h-56 w-full rounded-md object-cover"
          />
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Центр</div>
          <video
            src={values.centerVideo}
            poster={values.centerPoster}
            muted
            loop
            controls
            className="h-56 w-full rounded-md object-cover"
          />
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Праве фото</div>
          <Image
            src={values.rightImg}
            alt={values.altRight}
            width={600}
            height={800}
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
          disabled={saving || uploadingField !== null}
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
