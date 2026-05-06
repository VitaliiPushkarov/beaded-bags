import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { getHomeHeroBannerSettings } from '@/lib/home-hero-banner'

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

const PayloadSchema = z.object({
  desktopImage: ImagePathSchema,
  mobileImage: ImagePathSchema,
  linkHref: LinkHrefSchema,
  desktopAlt: z.string().trim().min(1).max(180),
  mobileAlt: z.string().trim().min(1).max(180),
})

function isAdmin(req: NextRequest): boolean {
  return req.cookies.get('admin-auth')?.value === 'true'
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settings = await getHomeHeroBannerSettings()
    return NextResponse.json({ settings }, { status: 200 })
  } catch (error) {
    console.error('Admin home hero GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const parsed = PayloadSchema.safeParse(await req.json())

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    const updated = await prisma.homeHeroBannerSettings.upsert({
      where: { id: 1 },
      update: {
        desktopImage: data.desktopImage,
        mobileImage: data.mobileImage,
        linkHref: data.linkHref,
        desktopAlt: data.desktopAlt,
        mobileAlt: data.mobileAlt,
      },
      create: {
        id: 1,
        desktopImage: data.desktopImage,
        mobileImage: data.mobileImage,
        linkHref: data.linkHref,
        desktopAlt: data.desktopAlt,
        mobileAlt: data.mobileAlt,
      },
      select: {
        desktopImage: true,
        mobileImage: true,
        linkHref: true,
        desktopAlt: true,
        mobileAlt: true,
      },
    })

    revalidatePath('/')

    return NextResponse.json({ settings: updated }, { status: 200 })
  } catch (error) {
    console.error('Admin home hero PUT error:', error)

    return NextResponse.json(
      { error: 'Не вдалося зберегти банер. Спробуйте ще раз.' },
      { status: 500 },
    )
  }
}
