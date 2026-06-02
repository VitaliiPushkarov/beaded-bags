import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import {
  getInstagramSliderSettings,
  sanitizeInstagramPostsPayload,
} from '@/lib/home-page-config'
import {
  getHomeHeroBannerSettings,
  HOME_HERO_BANNER_DEFAULTS,
} from '@/lib/home-hero-banner'

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

const LinkHrefSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      value.startsWith('/') ||
      value.startsWith('http://') ||
      value.startsWith('https://'),
    'Invalid link href',
  )

const PostSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  src: ImagePathSchema,
  href: LinkHrefSchema,
  alt: z.string().trim().min(1).max(180),
  caption: z.string().trim().max(500).default(''),
  sort: z.coerce.number().int().min(0).optional().default(0),
  isActive: z.coerce.boolean().optional().default(true),
})

const PayloadSchema = z.object({
  posts: z.array(PostSchema).min(1).max(20),
})

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  try {
    const settings = await getInstagramSliderSettings()
    return NextResponse.json({ settings }, { status: 200 })
  } catch (error) {
    console.error('Admin instagram slider GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  try {
    const parsed = PayloadSchema.safeParse(await req.json())

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const posts = sanitizeInstagramPostsPayload(parsed.data.posts)
    const hero = await getHomeHeroBannerSettings()
    const fallbackSlide =
      hero.slides.find((slide) => slide.isActive) ||
      hero.slides[0] ||
      HOME_HERO_BANNER_DEFAULTS.slides[0]

    const updated = await prisma.homeHeroBannerSettings.upsert({
      where: { id: 1 },
      update: {
        instagramPosts: posts,
      },
      create: {
        id: 1,
        desktopImage: fallbackSlide.desktopImage,
        mobileImage: fallbackSlide.mobileImage,
        linkHref: fallbackSlide.linkHref,
        desktopAlt: fallbackSlide.desktopAlt,
        mobileAlt: fallbackSlide.mobileAlt,
        slides: hero.slides.length > 0 ? hero.slides : HOME_HERO_BANNER_DEFAULTS.slides,
        instagramPosts: posts,
      },
      select: {
        instagramPosts: true,
      },
    })

    revalidatePath('/')
    revalidatePath('/admin/configuration')

    return NextResponse.json(
      {
        settings: {
          posts: sanitizeInstagramPostsPayload(
            (updated.instagramPosts || posts) as typeof posts,
          ),
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Admin instagram slider PUT error:', error)

    return NextResponse.json(
      { error: 'Не вдалося зберегти Instagram слайдер. Спробуйте ще раз.' },
      { status: 500 },
    )
  }
}
