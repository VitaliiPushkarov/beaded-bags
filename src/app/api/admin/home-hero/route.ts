import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import {
  getHomeHeroBannerSettings,
  HOME_HERO_BANNER_DEFAULTS,
  type HomeHeroSlideDTO,
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

const SlideSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  desktopImage: ImagePathSchema,
  mobileImage: ImagePathSchema,
  linkHref: LinkHrefSchema,
  desktopAlt: z.string().trim().min(1).max(180),
  mobileAlt: z.string().trim().min(1).max(180),
  sort: z.coerce.number().int().min(0).optional().default(0),
  isActive: z.coerce.boolean().optional().default(true),
})

const PayloadSchema = z.object({
  slides: z.array(SlideSchema).min(1).max(20),
})

function normalizeSlides(slides: z.infer<typeof SlideSchema>[]): HomeHeroSlideDTO[] {
  const seenIds = new Set<string>()

  return slides
    .map((slide, index) => {
      let id = String(slide.id || '').trim() || `home-hero-slide-${index + 1}`
      while (seenIds.has(id)) {
        id = `${id}-${index + 1}`
      }
      seenIds.add(id)

      return {
        id,
        desktopImage: slide.desktopImage,
        mobileImage: slide.mobileImage,
        linkHref: slide.linkHref,
        desktopAlt: slide.desktopAlt,
        mobileAlt: slide.mobileAlt,
        sort: Math.max(0, Number(slide.sort) || 0),
        isActive: slide.isActive !== false,
      }
    })
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  try {
    const settings = await getHomeHeroBannerSettings()
    return NextResponse.json({ settings }, { status: 200 })
  } catch (error) {
    console.error('Admin home hero GET error:', error)
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

    const data = parsed.data
    const slides = normalizeSlides(data.slides)
    const primarySlide =
      slides.find((slide) => slide.isActive) ||
      slides[0] ||
      HOME_HERO_BANNER_DEFAULTS.slides[0]

    const updated = await prisma.homeHeroBannerSettings.upsert({
      where: { id: 1 },
      update: {
        slides,
        desktopImage: primarySlide.desktopImage,
        mobileImage: primarySlide.mobileImage,
        linkHref: primarySlide.linkHref,
        desktopAlt: primarySlide.desktopAlt,
        mobileAlt: primarySlide.mobileAlt,
      },
      create: {
        id: 1,
        slides,
        desktopImage: primarySlide.desktopImage,
        mobileImage: primarySlide.mobileImage,
        linkHref: primarySlide.linkHref,
        desktopAlt: primarySlide.desktopAlt,
        mobileAlt: primarySlide.mobileAlt,
      },
      select: {
        slides: true,
      },
    })

    revalidatePath('/')

    return NextResponse.json(
      {
        settings: {
          slides: updated.slides,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('Admin home hero PUT error:', error)

    return NextResponse.json(
      { error: 'Не вдалося зберегти банер. Спробуйте ще раз.' },
      { status: 500 },
    )
  }
}
