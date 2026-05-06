import { prisma } from '@/lib/prisma'

export type HomeHeroBannerSettingsDTO = {
  desktopImage: string
  mobileImage: string
  linkHref: string
  desktopAlt: string
  mobileAlt: string
}

export const HOME_HERO_BANNER_DEFAULTS: HomeHeroBannerSettingsDTO = {
  desktopImage: '/img/hero-block-01.jpg',
  mobileImage: '/img/hero-block-m.jpg',
  linkHref: '/shop',
  desktopAlt: 'Gerdan Hero',
  mobileAlt: 'Gerdan Hero Mobile',
}

function clean(input: unknown): string {
  return typeof input === 'string' ? input.trim() : ''
}

function mergeWithDefaults(
  input: Partial<HomeHeroBannerSettingsDTO> | null | undefined,
): HomeHeroBannerSettingsDTO {
  return {
    desktopImage:
      clean(input?.desktopImage) || HOME_HERO_BANNER_DEFAULTS.desktopImage,
    mobileImage: clean(input?.mobileImage) || HOME_HERO_BANNER_DEFAULTS.mobileImage,
    linkHref: clean(input?.linkHref) || HOME_HERO_BANNER_DEFAULTS.linkHref,
    desktopAlt: clean(input?.desktopAlt) || HOME_HERO_BANNER_DEFAULTS.desktopAlt,
    mobileAlt: clean(input?.mobileAlt) || HOME_HERO_BANNER_DEFAULTS.mobileAlt,
  }
}

export async function getHomeHeroBannerSettings(): Promise<HomeHeroBannerSettingsDTO> {
  const row = await prisma.homeHeroBannerSettings.findUnique({
    where: { id: 1 },
    select: {
      desktopImage: true,
      mobileImage: true,
      linkHref: true,
      desktopAlt: true,
      mobileAlt: true,
    },
  })

  return mergeWithDefaults(row)
}
