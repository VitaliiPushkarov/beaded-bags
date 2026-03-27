import { BlogPostStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'

export type BlogSection = {
  heading: string
  paragraphs: string[]
}

export type BlogPost = {
  id: string
  slug: string
  title: string
  excerpt: string
  description: string
  coverImage: string
  coverImageAlt: string
  keywords: string[]
  publishedAt: string
  updatedAt: string
  readingMinutes: number
  status: BlogPostStatus
  sections: BlogSection[]
}

type BlogPostQueryOptions = {
  includeUnpublished?: boolean
}

type BlogPostRow = {
  id: string
  slug: string
  title: string
  excerpt: string
  description: string
  coverImage: string
  coverImageAlt: string
  keywords: string[]
  publishedAt: Date | null
  readingMinutes: number
  status: BlogPostStatus
  sections: unknown
  createdAt: Date
  updatedAt: Date
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function normalizeBlogSections(input: unknown): BlogSection[] {
  if (!Array.isArray(input)) return []

  return input
    .map((item) => {
      if (!isRecord(item)) return null

      const heading =
        typeof item.heading === 'string' ? item.heading.trim() : ''
      const rawParagraphs = Array.isArray(item.paragraphs) ? item.paragraphs : []
      const paragraphs = rawParagraphs
        .map((paragraph) =>
          typeof paragraph === 'string' ? paragraph.trim() : '',
        )
        .filter(Boolean)

      if (!heading || paragraphs.length === 0) return null

      return {
        heading,
        paragraphs,
      }
    })
    .filter((section): section is BlogSection => section !== null)
}

function mapBlogPost(row: BlogPostRow): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    description: row.description,
    coverImage: row.coverImage,
    coverImageAlt: row.coverImageAlt,
    keywords: row.keywords,
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    readingMinutes: row.readingMinutes,
    status: row.status,
    sections: normalizeBlogSections(row.sections),
  }
}

export async function getBlogPosts(
  options: BlogPostQueryOptions = {},
): Promise<BlogPost[]> {
  const includeUnpublished = options.includeUnpublished ?? false

  const rows = await prisma.blogPost.findMany({
    where: includeUnpublished
      ? undefined
      : {
          status: 'PUBLISHED',
          publishedAt: {
            not: null,
            lte: new Date(),
          },
        },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      description: true,
      coverImage: true,
      coverImageAlt: true,
      keywords: true,
      publishedAt: true,
      readingMinutes: true,
      status: true,
      sections: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return rows.map(mapBlogPost)
}

export async function getBlogPostBySlug(
  slug: string,
  options: BlogPostQueryOptions = {},
): Promise<BlogPost | null> {
  const includeUnpublished = options.includeUnpublished ?? false

  const row = await prisma.blogPost.findFirst({
    where: includeUnpublished
      ? { slug }
      : {
          slug,
          status: 'PUBLISHED',
          publishedAt: {
            not: null,
            lte: new Date(),
          },
        },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      description: true,
      coverImage: true,
      coverImageAlt: true,
      keywords: true,
      publishedAt: true,
      readingMinutes: true,
      status: true,
      sections: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return row ? mapBlogPost(row) : null
}
