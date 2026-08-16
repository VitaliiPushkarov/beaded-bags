import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'

import { requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import {
  getHomeCategoryCardsSettings,
  HOME_CONFIG_CACHE_TAG,
  sanitizeHomeCategoryCardsPayload,
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

const CategoryCardSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(80),
  titleEn: z.string().trim().max(80).default(''),
  href: LinkHrefSchema,
  image: ImagePathSchema,
  subtitle: z.string().trim().min(1).max(160),
  subtitleEn: z.string().trim().max(160).default(''),
  sort: z.coerce.number().int().min(0).optional().default(0),
  isActive: z.coerce.boolean().optional().default(true),
})

const PayloadSchema = z.object({
  cards: z.array(CategoryCardSchema).min(1).max(20),
})

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  try {
    const settings = await getHomeCategoryCardsSettings()
    return NextResponse.json({ settings }, { status: 200 })
  } catch (error) {
    console.error('Admin category cards GET error:', error)
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

    const cards = sanitizeHomeCategoryCardsPayload(parsed.data.cards)
    const hero = await getHomeHeroBannerSettings()
    const fallbackSlide =
      hero.slides.find((slide) => slide.isActive) ||
      hero.slides[0] ||
      HOME_HERO_BANNER_DEFAULTS.slides[0]

    const updated = await prisma.homeHeroBannerSettings.upsert({
      where: { id: 1 },
      update: {
        categoryCards: cards,
      },
      create: {
        id: 1,
        desktopImage: fallbackSlide.desktopImage,
        mobileImage: fallbackSlide.mobileImage,
        linkHref: fallbackSlide.linkHref,
        desktopAlt: fallbackSlide.desktopAlt,
        mobileAlt: fallbackSlide.mobileAlt,
        slides:
          hero.slides.length > 0 ? hero.slides : HOME_HERO_BANNER_DEFAULTS.slides,
        categoryCards: cards,
      },
      select: {
        categoryCards: true,
      },
    })

    revalidateTag(HOME_CONFIG_CACHE_TAG, 'max')
    revalidatePath('/')
    revalidatePath('/admin/configuration')

    return NextResponse.json(
      {
        settings: {
          cards: sanitizeHomeCategoryCardsPayload(
            (updated.categoryCards || cards) as typeof cards,
          ),
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Admin category cards PUT error:', error)

    return NextResponse.json(
      { error: 'Не вдалося зберегти картки категорій. Спробуйте ще раз.' },
      { status: 500 },
    )
  }
}
