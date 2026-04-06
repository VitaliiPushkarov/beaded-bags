import { NextRequest, NextResponse } from 'next/server'
import { BlogPostStatus } from '@prisma/client'
import { z } from 'zod'

import { normalizeBlogSections } from '@/lib/blog'
import { prisma } from '@/lib/prisma'
import { revalidateBlogCache } from '@/lib/revalidate-blog'

const ImagePathSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      value.startsWith('/') ||
      value.startsWith('http://') ||
      value.startsWith('https://'),
    'Invalid image path',
  )

const NullableDateSchema = z.preprocess(
  (value) => {
    if (value === '' || value == null) return null
    if (value instanceof Date) return value
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? value : parsed
    }
    return value
  },
  z.date().nullable(),
)

const BlogSectionSchema = z.object({
  heading: z.string().trim().min(1),
  paragraphs: z.array(z.string().trim().min(1)).min(1),
})

const BlogPostSchema = z.object({
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  excerpt: z.string().trim().min(1),
  description: z.string().trim().min(1),
  coverImage: ImagePathSchema,
  coverImageAlt: z.string().trim().min(1),
  keywords: z.array(z.string().trim().min(1)).default([]),
  readingMinutes: z.coerce.number().int().min(1).max(120).default(4),
  status: z.nativeEnum(BlogPostStatus).default(BlogPostStatus.DRAFT),
  publishedAt: NullableDateSchema.default(null),
  sections: z.array(BlogSectionSchema).default([]),
})

function normalizeKeywords(keywords: string[]): string[] {
  const unique = new Set<string>()

  for (const item of keywords) {
    const normalized = item.trim().toLowerCase()
    if (!normalized) continue
    unique.add(normalized)
  }

  return Array.from(unique)
}

function resolvePublishedAt(input: {
  status: BlogPostStatus
  incomingPublishedAt: Date | null
  existingPublishedAt?: Date | null
}) {
  if (input.status === 'PUBLISHED') {
    return input.incomingPublishedAt ?? input.existingPublishedAt ?? new Date()
  }

  return input.incomingPublishedAt ?? input.existingPublishedAt ?? null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const existing = await prisma.blogPost.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        status: true,
        publishedAt: true,
        sections: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Статтю не знайдено' }, { status: 404 })
    }

    const parsed = BlogPostSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const payload = parsed.data
    const normalizedIncomingSections = normalizeBlogSections(payload.sections)
    const normalizedExistingSections = normalizeBlogSections(existing.sections)

    const updated = await prisma.blogPost.update({
      where: { id },
      data: {
        slug: payload.slug,
        title: payload.title,
        excerpt: payload.excerpt,
        description: payload.description,
        coverImage: payload.coverImage,
        coverImageAlt: payload.coverImageAlt,
        keywords: normalizeKeywords(payload.keywords),
        readingMinutes: payload.readingMinutes,
        status: payload.status,
        publishedAt: resolvePublishedAt({
          status: payload.status,
          incomingPublishedAt: payload.publishedAt,
          existingPublishedAt: existing.publishedAt,
        }),
        sections:
          normalizedIncomingSections.length > 0
            ? normalizedIncomingSections
            : normalizedExistingSections,
      },
      select: {
        id: true,
        slug: true,
        status: true,
      },
    })

    revalidateBlogCache({
      before: {
        slug: existing.slug,
        status: existing.status,
      },
      after: {
        slug: updated.slug,
        status: updated.status,
      },
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error('Admin update blog post error:', error)

    const message =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
        ? 'Стаття з таким slug вже існує'
        : 'Internal Server Error'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const existing = await prisma.blogPost.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        status: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Статтю не знайдено' }, { status: 404 })
    }

    await prisma.blogPost.delete({
      where: { id },
    })

    revalidateBlogCache({
      before: {
        slug: existing.slug,
        status: existing.status,
      },
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error('Admin delete blog post error:', error)
    return NextResponse.json(
      { error: 'Не вдалося видалити статтю' },
      { status: 500 },
    )
  }
}
