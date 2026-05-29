'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import type {
  InstagramPostDTO,
  InstagramSliderSettingsDTO,
} from '@/lib/home-page-config'

type Props = {
  initial: InstagramSliderSettingsDTO
}

function createPostId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `instagram-post-${Date.now()}`
}

function createBlankPost(sort: number): InstagramPostDTO {
  return {
    id: createPostId(),
    src: '/img/instagram/inst1.jpg',
    href: 'https://www.instagram.com/gerdan.studio/',
    alt: `Instagram Image ${sort}`,
    caption: '',
    sort,
    isActive: true,
  }
}

export default function InstagramSliderForm({ initial }: Props) {
  const [values, setValues] = useState<InstagramSliderSettingsDTO>(initial)
  const [savedValues, setSavedValues] = useState<InstagramSliderSettingsDTO>(initial)
  const [saving, setSaving] = useState(false)
  const [uploadingPostId, setUploadingPostId] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const posts = useMemo(
    () =>
      [...(values.posts || [])].sort(
        (a, b) => a.sort - b.sort || a.id.localeCompare(b.id),
      ),
    [values.posts],
  )

  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(savedValues),
    [savedValues, values],
  )

  async function uploadToCloudinary(file: File): Promise<string> {
    const sigRes = await fetch('/api/admin/cloudinary/signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: 'gerdan/instagram' }),
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

  function updatePost(postId: string, patch: Partial<InstagramPostDTO>) {
    setValues((prev) => ({
      ...prev,
      posts: (prev.posts || []).map((post) =>
        post.id === postId ? { ...post, ...patch } : post,
      ),
    }))
  }

  function removePost(postId: string) {
    setValues((prev) => {
      const next = (prev.posts || []).filter((post) => post.id !== postId)
      if (next.length === 0) {
        return {
          ...prev,
          posts: [createBlankPost(1)],
        }
      }

      return {
        ...prev,
        posts: next,
      }
    })
  }

  function addPost() {
    setValues((prev) => ({
      ...prev,
      posts: [...(prev.posts || []), createBlankPost((prev.posts || []).length + 1)],
    }))
  }

  async function onPickFile(event: ChangeEvent<HTMLInputElement>, postId: string) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setSuccess(null)
      setError(null)
      setUploadingPostId(postId)

      const url = await uploadToCloudinary(file)
      updatePost(postId, { src: url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка завантаження')
    } finally {
      setUploadingPostId(null)
      event.target.value = ''
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setSuccess(null)
      setError(null)

      const payload: InstagramSliderSettingsDTO = {
        posts: posts.map((post, index) => ({
          ...post,
          sort: Number.isFinite(Number(post.sort))
            ? Math.max(0, Math.round(Number(post.sort)))
            : index + 1,
          isActive: post.isActive !== false,
        })),
      }

      const res = await fetch('/api/admin/instagram-slider', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const responsePayload = (await res.json().catch(() => ({}))) as {
        error?: string | { fieldErrors?: Record<string, string[]> }
        settings?: InstagramSliderSettingsDTO
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

        setError('Не вдалося зберегти Instagram слайдер')
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
        <h2 className="text-2xl font-semibold">InstagramSlider на головній</h2>
        <button
          type="button"
          onClick={addPost}
          className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Додати пост
        </button>
      </div>

      <div className="space-y-6">
        {posts.map((post, index) => {
          const uploadId = `instagram-post-upload-${post.id}`

          return (
            <div key={post.id} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-800">Пост #{index + 1}</div>
                <button
                  type="button"
                  onClick={() => removePost(post.id)}
                  className="cursor-pointer rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                  disabled={posts.length <= 1}
                >
                  Видалити
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="block text-sm font-medium text-slate-800">
                  <div>Фото (URL)</div>
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={post.src}
                    onChange={(e) => updatePost(post.id, { src: e.target.value })}
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
                    onChange={(e) => onPickFile(e, post.id)}
                  />
                  {uploadingPostId === post.id ? (
                    <span className="mt-1 inline-block text-xs text-slate-500">
                      Завантажую...
                    </span>
                  ) : null}
                </div>

                <label className="block text-sm font-medium text-slate-800">
                  Посилання на пост
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={post.href}
                    onChange={(e) => updatePost(post.id, { href: e.target.value })}
                    required
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <label className="block text-sm font-medium text-slate-800">
                  ALT
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={post.alt}
                    onChange={(e) => updatePost(post.id, { alt: e.target.value })}
                    required
                  />
                </label>

                <label className="block text-sm font-medium text-slate-800">
                  Позиція
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    inputMode="numeric"
                    value={String(post.sort)}
                    onChange={(e) =>
                      updatePost(post.id, {
                        sort: Number(e.target.value.replace(/[^\d]/g, '')) || 0,
                      })
                    }
                  />
                </label>
              </div>

              <label className="mt-4 block text-sm font-medium text-slate-800">
                Підпис
                <textarea
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                  value={post.caption}
                  onChange={(e) => updatePost(post.id, { caption: e.target.value })}
                  placeholder="Короткий опис поста"
                />
              </label>

              <label className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={post.isActive}
                  onChange={(e) => updatePost(post.id, { isActive: e.target.checked })}
                />
                Активний пост
              </label>

              <div className="mt-4 rounded-lg border border-slate-200 p-3">
                <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Preview</div>
                <Image
                  src={post.src}
                  alt={post.alt}
                  width={900}
                  height={1400}
                  className="h-64 w-full rounded-md object-cover"
                />
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
          disabled={saving || uploadingPostId !== null}
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
