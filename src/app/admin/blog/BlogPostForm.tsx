'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BlogPostStatus } from '@prisma/client'

type SectionInput = {
  heading: string
  paragraphsText: string
}

type BlogPostFormValues = {
  id?: string
  slug: string
  title: string
  excerpt: string
  description: string
  coverImage: string
  coverImageAlt: string
  keywords: string
  readingMinutes: string
  status: BlogPostStatus
  publishedAt: string
  sections: SectionInput[]
}

type Props = {
  mode: 'create' | 'edit'
  initial?: BlogPostFormValues
}

const STATUS_OPTIONS: Array<{ value: BlogPostStatus; label: string }> = [
  { value: 'DRAFT', label: 'Чернетка' },
  { value: 'PUBLISHED', label: 'Опубліковано' },
  { value: 'ARCHIVED', label: 'Архів' },
]

function toDateTimeLocalValue(isoDate?: string | null) {
  if (!isoDate) return ''

  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''

  const pad = (value: number) => String(value).padStart(2, '0')

  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function splitKeywords(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/,|\n/)
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    ),
  )
}

function splitParagraphs(input: string): string[] {
  return input
    .split('\n')
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

const EMPTY_SECTION: SectionInput = {
  heading: '',
  paragraphsText: '',
}

export default function BlogPostForm({ mode, initial }: Props) {
  const router = useRouter()

  const [values, setValues] = useState<BlogPostFormValues>(
    initial ?? {
      slug: '',
      title: '',
      excerpt: '',
      description: '',
      coverImage: '',
      coverImageAlt: '',
      keywords: '',
      readingMinutes: '4',
      status: 'DRAFT',
      publishedAt: '',
      sections: [{ ...EMPTY_SECTION }],
    },
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const endpoint =
    mode === 'create' ? '/api/admin/blog' : `/api/admin/blog/${values.id}`
  const method = mode === 'create' ? 'POST' : 'PATCH'

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const payload = {
        slug: values.slug.trim(),
        title: values.title.trim(),
        excerpt: values.excerpt.trim(),
        description: values.description.trim(),
        coverImage: values.coverImage.trim(),
        coverImageAlt: values.coverImageAlt.trim(),
        keywords: splitKeywords(values.keywords),
        readingMinutes: Number(values.readingMinutes || 0),
        status: values.status,
        publishedAt: values.publishedAt
          ? new Date(values.publishedAt).toISOString()
          : null,
        sections: values.sections
          .map((section) => ({
            heading: section.heading.trim(),
            paragraphs: splitParagraphs(section.paragraphsText),
          }))
          .filter(
            (section) => section.heading.length > 0 && section.paragraphs.length > 0,
          ),
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const body = await response.json().catch(() => null)
      if (!response.ok) {
        const message =
          (body && typeof body.error === 'string' ? body.error : null) ??
          'Не вдалося зберегти статтю'
        throw new Error(message)
      }

      router.push('/admin/blog')
      router.refresh()
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Не вдалося зберегти статтю'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!values.id || mode !== 'edit') return

    const confirmed = window.confirm('Видалити статтю безповоротно?')
    if (!confirmed) return

    setDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/blog/${values.id}`, {
        method: 'DELETE',
      })
      const body = await response.json().catch(() => null)

      if (!response.ok) {
        const message =
          (body && typeof body.error === 'string' ? body.error : null) ??
          'Не вдалося видалити статтю'
        throw new Error(message)
      }

      router.push('/admin/blog')
      router.refresh()
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : 'Не вдалося видалити статтю'
      setError(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Заголовок
          </span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.title}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, title: event.target.value }))
            }
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Slug</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.slug}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, slug: event.target.value }))
            }
            required
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Короткий опис (excerpt)
        </span>
        <textarea
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          rows={3}
          value={values.excerpt}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, excerpt: event.target.value }))
          }
          required
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Meta description
        </span>
        <textarea
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          rows={3}
          value={values.description}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, description: event.target.value }))
          }
          required
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Обкладинка (URL або `/img/...`)
          </span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.coverImage}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, coverImage: event.target.value }))
            }
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Alt обкладинки
          </span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.coverImageAlt}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, coverImageAlt: event.target.value }))
            }
            required
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Keywords (через кому)
          </span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.keywords}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, keywords: event.target.value }))
            }
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Час читання (хв)
          </span>
          <input
            type="number"
            min={1}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.readingMinutes}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, readingMinutes: event.target.value }))
            }
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Статус</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.status}
            onChange={(event) =>
              setValues((prev) => ({
                ...prev,
                status: event.target.value as BlogPostStatus,
              }))
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block max-w-sm">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Дата публікації
        </span>
        <input
          type="datetime-local"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={values.publishedAt}
          onChange={(event) =>
            setValues((prev) => ({ ...prev, publishedAt: event.target.value }))
          }
        />
      </label>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Секції статті</h2>
        </div>

        {values.sections.map((section, index) => (
          <div key={index} className="rounded-md border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Секція #{index + 1}</p>
              <button
                type="button"
                className="text-sm text-red-600"
                onClick={() =>
                  setValues((prev) => {
                    if (prev.sections.length === 1) return prev
                    return {
                      ...prev,
                      sections: prev.sections.filter((_, idx) => idx !== index),
                    }
                  })
                }
              >
                Видалити
              </button>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm text-slate-700">Підзаголовок</span>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={section.heading}
                onChange={(event) =>
                  setValues((prev) => {
                    const sections = [...prev.sections]
                    sections[index] = {
                      ...sections[index],
                      heading: event.target.value,
                    }
                    return { ...prev, sections }
                  })
                }
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-slate-700">
                Параграфи (кожен з нового рядка)
              </span>
              <textarea
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                rows={6}
                value={section.paragraphsText}
                onChange={(event) =>
                  setValues((prev) => {
                    const sections = [...prev.sections]
                    sections[index] = {
                      ...sections[index],
                      paragraphsText: event.target.value,
                    }
                    return { ...prev, sections }
                  })
                }
              />
            </label>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={saving || deleting}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
          onClick={() =>
            setValues((prev) => ({
              ...prev,
              sections: [...prev.sections, { ...EMPTY_SECTION }],
            }))
          }
        >
          Додати секцію
        </button>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {mode === 'edit' ? (
            <button
              type="button"
              disabled={saving || deleting}
              onClick={onDelete}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
            >
              {deleting ? 'Видалення...' : 'Видалити статтю'}
            </button>
          ) : null}

          <button
            type="submit"
            disabled={saving || deleting}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving
              ? 'Збереження...'
              : mode === 'create'
                ? 'Створити статтю'
                : 'Зберегти зміни'}
          </button>
        </div>
      </div>
    </form>
  )
}

export function mapPublishedAtToInputValue(isoDate?: string | null) {
  return toDateTimeLocalValue(isoDate)
}
