import { unstable_cache } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { HOME_CONFIG_CACHE_TAG } from '@/lib/home-page-config'
import {
  isPrismaAvailabilityError,
  withPrismaRetry,
} from '@/lib/prisma-resilience'

const HOME_HERO_REVALIDATE_SECONDS = 300

export type HomeHeroSlideDTO = {
  id: string
  desktopImage: string
  mobileImage: string
  linkHref: string
  desktopAlt: string
  mobileAlt: string
  sort: number
  isActive: boolean
}

export type HomeHeroBannerSettingsDTO = {
  slides: HomeHeroSlideDTO[]
}

const DEFAULT_SLIDE: HomeHeroSlideDTO = {
  id: 'home-hero-slide-1',
  desktopImage: '/img/hero-block-01.jpg',
  mobileImage: '/img/hero-block-m.jpg',
  linkHref: '/shop',
  desktopAlt: 'Gerdan Hero',
  mobileAlt: 'Gerdan Hero Mobile',
  sort: 1,
  isActive: true,
}

export const HOME_HERO_BANNER_DEFAULTS: HomeHeroBannerSettingsDTO = {
  slides: [DEFAULT_SLIDE],
}

function clean(input: unknown): string {
  return typeof input === 'string' ? input.trim() : ''
}

function sanitizeSort(input: unknown, fallback: number): number {
  const parsed = Number(input)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.round(parsed))
}

function normalizeSlides(input: unknown): HomeHeroSlideDTO[] {
  if (!Array.isArray(input)) return []

  const slides = input
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const source = item as Record<string, unknown>

      const desktopImage = clean(source.desktopImage)
      const mobileImage = clean(source.mobileImage)
      const linkHref = clean(source.linkHref)
      const desktopAlt = clean(source.desktopAlt)
      const mobileAlt = clean(source.mobileAlt)

      if (!desktopImage || !mobileImage || !linkHref) return null

      return {
        id: clean(source.id) || `home-hero-slide-${index + 1}`,
        desktopImage,
        mobileImage,
        linkHref,
        desktopAlt: desktopAlt || DEFAULT_SLIDE.desktopAlt,
        mobileAlt: mobileAlt || DEFAULT_SLIDE.mobileAlt,
        sort: sanitizeSort(source.sort, index + 1),
        isActive: source.isActive !== false,
      } satisfies HomeHeroSlideDTO
    })
    .filter((item): item is HomeHeroSlideDTO => Boolean(item))
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))

  return slides
}

function mergeWithDefaults(input: {
  slides?: unknown
  desktopImage?: string | null
  mobileImage?: string | null
  linkHref?: string | null
  desktopAlt?: string | null
  mobileAlt?: string | null
} | null | undefined): HomeHeroBannerSettingsDTO {
  const fromJson = normalizeSlides(input?.slides)
  if (fromJson.length > 0) {
    return { slides: fromJson }
  }

  const legacySlide: HomeHeroSlideDTO = {
    id: DEFAULT_SLIDE.id,
    desktopImage: clean(input?.desktopImage) || DEFAULT_SLIDE.desktopImage,
    mobileImage: clean(input?.mobileImage) || DEFAULT_SLIDE.mobileImage,
    linkHref: clean(input?.linkHref) || DEFAULT_SLIDE.linkHref,
    desktopAlt: clean(input?.desktopAlt) || DEFAULT_SLIDE.desktopAlt,
    mobileAlt: clean(input?.mobileAlt) || DEFAULT_SLIDE.mobileAlt,
    sort: 1,
    isActive: true,
  }

  return {
    slides: [legacySlide],
  }
}

async function queryHomeHeroBannerSettings(): Promise<HomeHeroBannerSettingsDTO> {
  try {
    const row = await withPrismaRetry(
      () =>
        prisma.homeHeroBannerSettings.findUnique({
          where: { id: 1 },
          select: {
            slides: true,
            desktopImage: true,
            mobileImage: true,
            linkHref: true,
            desktopAlt: true,
            mobileAlt: true,
          },
        }),
      { scope: 'homeHeroBannerSettings.findUnique' },
    )

    return mergeWithDefaults(row)
  } catch (error) {
    if (isPrismaAvailabilityError(error)) {
      console.error(
        '[db] Failed to load home hero banner settings from DB, using defaults.',
        error,
      )
      return { ...HOME_HERO_BANNER_DEFAULTS }
    }
    throw error
  }
}

export const getHomeHeroBannerSettings = unstable_cache(
  queryHomeHeroBannerSettings,
  ['home-hero-banner-settings'],
  { tags: [HOME_CONFIG_CACHE_TAG], revalidate: HOME_HERO_REVALIDATE_SECONDS },
)
