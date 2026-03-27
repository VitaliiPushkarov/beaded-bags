import Link from 'next/link'

import BlogPostForm, { mapPublishedAtToInputValue } from '../BlogPostForm'
import { normalizeBlogSections } from '@/lib/blog'
import { prisma } from '@/lib/prisma'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function AdminBlogEditPage({ params }: PageProps) {
  const { id } = await params

  const post = await prisma.blogPost.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      description: true,
      coverImage: true,
      coverImageAlt: true,
      keywords: true,
      readingMinutes: true,
      status: true,
      publishedAt: true,
      sections: true,
    },
  })

  if (!post) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h1 className="text-lg font-semibold">Статтю не знайдено</h1>
        <Link href="/admin/blog" className="mt-3 inline-block text-sm underline">
          ← До списку статей
        </Link>
      </div>
    )
  }

  const sections = normalizeBlogSections(post.sections)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Редагування статті</h1>
        <p className="text-sm text-slate-600">
          Оновіть контент і статус публікації.
        </p>
      </div>

      <BlogPostForm
        mode="edit"
        initial={{
          id: post.id,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          description: post.description,
          coverImage: post.coverImage,
          coverImageAlt: post.coverImageAlt,
          keywords: post.keywords.join(', '),
          readingMinutes: String(post.readingMinutes),
          status: post.status,
          publishedAt: mapPublishedAtToInputValue(post.publishedAt?.toISOString()),
          sections:
            sections.length > 0
              ? sections.map((section) => ({
                  heading: section.heading,
                  paragraphsText: section.paragraphs.join('\n'),
                }))
              : [{ heading: '', paragraphsText: '' }],
        }}
      />
    </div>
  )
}
