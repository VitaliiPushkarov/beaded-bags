import Link from 'next/link'

import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const STATUS_LABELS = {
  DRAFT: 'Чернетка',
  PUBLISHED: 'Опубліковано',
  ARCHIVED: 'Архів',
} as const

const STATUS_CLASSNAMES = {
  DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
  PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ARCHIVED: 'bg-slate-100 text-slate-600 border-slate-200',
} as const

function formatDate(value: Date | null) {
  if (!value) return '-'
  return value.toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export default async function AdminBlogPage() {
  const posts = await prisma.blogPost.findMany({
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      readingMinutes: true,
      publishedAt: true,
      updatedAt: true,
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Блог</h1>
          <p className="text-sm text-slate-600">
            Керуйте статтями та публікаціями блогу з адмін-панелі.
          </p>
        </div>
        <Link
          href="/admin/blog/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Нова стаття
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          Поки що немає статей. Створіть першу публікацію.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Стаття</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Публ.</th>
                <th className="px-4 py-3">Оновлено</th>
                <th className="px-4 py-3">Дії</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{post.title}</div>
                    <div className="text-xs text-slate-500">{post.slug}</div>
                    <div className="text-xs text-slate-500">
                      {post.readingMinutes} хв читання
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-xs ${STATUS_CLASSNAMES[post.status]}`}
                    >
                      {STATUS_LABELS[post.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatDate(post.publishedAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatDate(post.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/admin/blog/${post.id}`}
                        className="text-slate-900 underline"
                      >
                        Редагувати
                      </Link>
                      <Link href={`/blog/${post.slug}`} className="text-slate-600 underline">
                        На сайті
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
