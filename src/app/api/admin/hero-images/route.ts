import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'

import { requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import {
  getHeroImagesSettings,
  HOME_CONFIG_CACHE_TAG,
  sanitizeHeroImagesPayload,
} from '@/lib/home-page-config'
import {
  getHomeHeroBannerSettings,
  HOME_HERO_BANNER_DEFAULTS,
} from '@/lib/home-hero-banner'

const MediaPathSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      value.startsWith('/') ||
      value.startsWith('http://') ||
      value.startsWith('https://'),
    'Invalid media path',
  )

const PayloadSchema = z.object({
  leftImg: MediaPathSchema,
  centerVideo: MediaPathSchema,
  centerPoster: MediaPathSchema,
  rightImg: MediaPathSchema,
  altLeft: z.string().trim().min(1).max(180),
  altRight: z.string().trim().min(1).max(180),
})

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  try {
    const settings = await getHeroImagesSettings()
    return NextResponse.json({ settings }, { status: 200 })
  } catch (error) {
    console.error('Admin hero images GET error:', error)
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

    const settings = sanitizeHeroImagesPayload(parsed.data)
    const hero = await getHomeHeroBannerSettings()
    const fallbackSlide =
      hero.slides.find((slide) => slide.isActive) ||
      hero.slides[0] ||
      HOME_HERO_BANNER_DEFAULTS.slides[0]

    const updated = await prisma.homeHeroBannerSettings.upsert({
      where: { id: 1 },
      update: {
        heroImages: settings,
      },
      create: {
        id: 1,
        desktopImage: fallbackSlide.desktopImage,
        mobileImage: fallbackSlide.mobileImage,
        linkHref: fallbackSlide.linkHref,
        desktopAlt: fallbackSlide.desktopAlt,
        mobileAlt: fallbackSlide.mobileAlt,
        slides: hero.slides.length > 0 ? hero.slides : HOME_HERO_BANNER_DEFAULTS.slides,
        heroImages: settings,
      },
      select: {
        heroImages: true,
      },
    })

    revalidateTag(HOME_CONFIG_CACHE_TAG, 'max')
    revalidatePath('/')
    revalidatePath('/admin/configuration')

    return NextResponse.json(
      {
        settings: sanitizeHeroImagesPayload(
          (updated.heroImages || settings) as typeof settings,
        ),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Admin hero images PUT error:', error)

    return NextResponse.json(
      { error: 'Не вдалося зберегти HeroImages. Спробуйте ще раз.' },
      { status: 500 },
    )
  }
}
