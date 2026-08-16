import { unstable_cache } from 'next/cache'

import { prisma } from '@/lib/prisma'
import {
  isPrismaAvailabilityError,
  withPrismaRetry,
} from '@/lib/prisma-resilience'

// The home page is dynamically rendered (locale comes from the request host),
// so it queried the singleton homeHeroBannerSettings row on every request —
// three times, once per getter. These settings change only via the admin
// panel, so we cache them under a shared tag; admin mutations bust it with
// revalidateTag(HOME_CONFIG_CACHE_TAG, 'max').
export const HOME_CONFIG_CACHE_TAG = 'home-config'
const HOME_CONFIG_REVALIDATE_SECONDS = 300

export type HeroImagesSettingsDTO = {
  leftImg: string
  centerVideo: string
  centerPoster: string
  rightImg: string
  altLeft: string
  altRight: string
}

export type InstagramPostDTO = {
  id: string
  src: string
  href: string
  alt: string
  caption: string
  sort: number
  isActive: boolean
}

export type InstagramSliderSettingsDTO = {
  posts: InstagramPostDTO[]
}

export type HomeCategoryCardDTO = {
  id: string
  title: string
  titleEn: string
  href: string
  image: string
  subtitle: string
  subtitleEn: string
  sort: number
  isActive: boolean
}

export type HomeCategoryCardsSettingsDTO = {
  cards: HomeCategoryCardDTO[]
}

export const HERO_IMAGES_DEFAULTS: HeroImagesSettingsDTO = {
  leftImg: '/img/hero-img-1.webp',
  centerVideo: '/media/hero-video.mp4',
  centerPoster: '/img/hero-img-2.webp',
  rightImg: '/img/rightImg.jpg',
  altLeft: 'Beaded bag on rock',
  altRight: 'Model with beaded bag',
}

const INSTAGRAM_DEFAULT_POSTS: InstagramPostDTO[] = [
  {
    id: 'inst-1',
    src: '/img/instagram/inst1.jpg',
    href: 'https://www.instagram.com/p/DRsKzcsjNSG/',
    alt: 'Instagram Image 1',
    caption: 'Сумка Truffle Tote - мінімалізм, що витримує твій ритм дня.',
    sort: 1,
    isActive: true,
  },
  {
    id: 'inst-2',
    src: '/img/instagram/inst2.jpg',
    href: 'https://www.instagram.com/p/DRkWfJ1DIZo/',
    alt: 'Instagram Image 2',
    caption:
      'Cozy Bag — в’язана бананка-мішечок, що створена для твоїх шалених буднів.',
    sort: 2,
    isActive: true,
  },
  {
    id: 'inst-3',
    src: '/img/instagram/inst3.jpg',
    href: 'https://www.instagram.com/p/DRmxdVJDJ3L/?img_index=1',
    alt: 'Instagram Image 3',
    caption:
      'Металевий чохол з бісеру повторює її характер: стриманий, сталевий та витончений.',
    sort: 3,
    isActive: true,
  },
  {
    id: 'inst-4',
    src: '/img/instagram/inst4.jpg',
    href: 'https://www.instagram.com/p/DRzpakajLzB/?img_index=1',
    alt: 'Instagram Image 4',
    caption:
      'Gerdan Electric: лаймовий неон, лаконічна форма та знайомий усім класичний принт.',
    sort: 4,
    isActive: true,
  },
  {
    id: 'inst-5',
    src: '/img/instagram/inst5.jpg',
    href: 'https://www.instagram.com/p/DRuvg6_DOzc/?img_index=1',
    alt: 'Instagram Image 5',
    caption:
      'Рожева Cozy Bag виглядає, як базовий аксесуар, але чомусь усі обертаються.',
    sort: 5,
    isActive: true,
  },
  {
    id: 'inst-6',
    src: '/img/instagram/inst6.jpg',
    href: 'https://www.instagram.com/p/DRhyOB_jNAG/?img_index=1',
    alt: 'Instagram Image 6',
    caption: 'Gerdan Glassy — сумка, яка ніби створена зі скла.',
    sort: 6,
    isActive: true,
  },
]

export const INSTAGRAM_SLIDER_DEFAULTS: InstagramSliderSettingsDTO = {
  posts: INSTAGRAM_DEFAULT_POSTS,
}

const HOME_CATEGORY_DEFAULT_CARDS: HomeCategoryCardDTO[] = [
  {
    id: 'home-category-bags',
    title: 'Сумки',
    titleEn: 'Bags',
    href: '/shop/sumky',
    image: '/img/home-banner-v-day.webp',
    subtitle: 'Сумки ручної роботи',
    subtitleEn: 'Handmade bags',
    sort: 1,
    isActive: true,
  },
  {
    id: 'home-category-belt-bags',
    title: 'Бананки',
    titleEn: 'Belt Bags',
    href: '/shop/bananky',
    image: '/img/bananka-waffle-banana-00.jpg',
    subtitle: 'Компактний формат на щодень',
    subtitleEn: 'Compact daily format',
    sort: 2,
    isActive: true,
  },
  {
    id: 'home-category-shoppers',
    title: 'Шопери',
    titleEn: 'Shoppers',
    href: '/shop/shopery',
    image: '/img/shopper-lazy.jpg',
    subtitle: 'Для твоїх продуктів з ярмарку',
    subtitleEn: 'Spacious city models',
    sort: 3,
    isActive: true,
  },
  {
    id: 'home-category-cases',
    title: 'Чохли',
    titleEn: 'Cases',
    href: '/shop/chohly',
    image: '/img/metallic-case.jpg',
    subtitle: 'Практичні акценти',
    subtitleEn: 'Practical accents',
    sort: 4,
    isActive: true,
  },
  {
    id: 'home-category-accessories',
    title: 'Аксесуари',
    titleEn: 'Accessories',
    href: '/shop/accessories',
    image: '/img/fortune-brelok-01.jpg',
    subtitle: 'Брелоки, гердани, силянки',
    subtitleEn: 'Keychains, gerdans, sylyanky',
    sort: 5,
    isActive: true,
  },
]

export const HOME_CATEGORY_CARDS_DEFAULTS: HomeCategoryCardsSettingsDTO = {
  cards: HOME_CATEGORY_DEFAULT_CARDS,
}

function clean(input: unknown): string {
  return typeof input === 'string' ? input.trim() : ''
}

function cleanOptional(input: unknown, fallback: string): string {
  const value = clean(input)
  return value || fallback
}

function sanitizeSort(input: unknown, fallback: number): number {
  const parsed = Number(input)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.round(parsed))
}

function normalizeHeroImages(input: unknown): HeroImagesSettingsDTO {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}

  return {
    leftImg: cleanOptional(source.leftImg, HERO_IMAGES_DEFAULTS.leftImg),
    centerVideo: cleanOptional(source.centerVideo, HERO_IMAGES_DEFAULTS.centerVideo),
    centerPoster: cleanOptional(source.centerPoster, HERO_IMAGES_DEFAULTS.centerPoster),
    rightImg: cleanOptional(source.rightImg, HERO_IMAGES_DEFAULTS.rightImg),
    altLeft: cleanOptional(source.altLeft, HERO_IMAGES_DEFAULTS.altLeft),
    altRight: cleanOptional(source.altRight, HERO_IMAGES_DEFAULTS.altRight),
  }
}

function normalizeInstagramPosts(input: unknown): InstagramPostDTO[] {
  if (!Array.isArray(input)) return []

  const posts = input
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const source = item as Record<string, unknown>

      const src = clean(source.src)
      const href = clean(source.href)
      if (!src || !href) return null

      const fallback = INSTAGRAM_DEFAULT_POSTS[index % INSTAGRAM_DEFAULT_POSTS.length]

      return {
        id: clean(source.id) || `instagram-post-${index + 1}`,
        src,
        href,
        alt: cleanOptional(source.alt, fallback?.alt || `Instagram Image ${index + 1}`),
        caption: cleanOptional(source.caption, fallback?.caption || ''),
        sort: sanitizeSort(source.sort, index + 1),
        isActive: source.isActive !== false,
      } satisfies InstagramPostDTO
    })
    .filter((item): item is InstagramPostDTO => Boolean(item))
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))

  return posts
}

function normalizeCategoryCards(input: unknown): HomeCategoryCardDTO[] {
  if (!Array.isArray(input)) return []

  const cards = input
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const source = item as Record<string, unknown>

      const title = clean(source.title)
      const href = clean(source.href)
      const image = clean(source.image)
      const subtitle = clean(source.subtitle)

      if (!title || !href || !image || !subtitle) return null

      return {
        id: clean(source.id) || `home-category-card-${index + 1}`,
        title,
        titleEn: clean(source.titleEn),
        href,
        image,
        subtitle,
        subtitleEn: clean(source.subtitleEn),
        sort: sanitizeSort(source.sort, index + 1),
        isActive: source.isActive !== false,
      } satisfies HomeCategoryCardDTO
    })
    .filter((item): item is HomeCategoryCardDTO => Boolean(item))
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))

  return cards
}

async function queryHeroImagesSettings(): Promise<HeroImagesSettingsDTO> {
  try {
    const row = await withPrismaRetry(
      () =>
        prisma.homeHeroBannerSettings.findUnique({
          where: { id: 1 },
          select: { heroImages: true },
        }),
      { scope: 'homeHeroBannerSettings.findUnique.heroImages' },
    )

    return normalizeHeroImages(row?.heroImages)
  } catch (error) {
    if (isPrismaAvailabilityError(error)) {
      console.error(
        '[db] Failed to load hero images settings from DB, using defaults.',
        error,
      )
      return { ...HERO_IMAGES_DEFAULTS }
    }
    throw error
  }
}

async function queryInstagramSliderSettings(): Promise<InstagramSliderSettingsDTO> {
  try {
    const row = await withPrismaRetry(
      () =>
        prisma.homeHeroBannerSettings.findUnique({
          where: { id: 1 },
          select: { instagramPosts: true },
        }),
      { scope: 'homeHeroBannerSettings.findUnique.instagramPosts' },
    )

    const posts = normalizeInstagramPosts(row?.instagramPosts)
    if (posts.length === 0) {
      return { posts: [...INSTAGRAM_SLIDER_DEFAULTS.posts] }
    }

    const active = posts.filter((post) => post.isActive)
    return {
      posts: active.length > 0 ? active : posts,
    }
  } catch (error) {
    if (isPrismaAvailabilityError(error)) {
      console.error(
        '[db] Failed to load instagram slider settings from DB, using defaults.',
        error,
      )
      return { posts: [...INSTAGRAM_SLIDER_DEFAULTS.posts] }
    }
    throw error
  }
}

async function queryHomeCategoryCardsSettings(): Promise<HomeCategoryCardsSettingsDTO> {
  try {
    const row = await withPrismaRetry(
      () =>
        prisma.homeHeroBannerSettings.findUnique({
          where: { id: 1 },
          select: { categoryCards: true },
        }),
      { scope: 'homeHeroBannerSettings.findUnique.categoryCards' },
    )

    const cards = normalizeCategoryCards(row?.categoryCards)
    if (cards.length === 0) {
      return { cards: [...HOME_CATEGORY_CARDS_DEFAULTS.cards] }
    }

    return { cards }
  } catch (error) {
    if (isPrismaAvailabilityError(error)) {
      console.error(
        '[db] Failed to load category cards settings from DB, using defaults.',
        error,
      )
      return { cards: [...HOME_CATEGORY_CARDS_DEFAULTS.cards] }
    }
    throw error
  }
}

export const getHeroImagesSettings = unstable_cache(
  queryHeroImagesSettings,
  ['home-hero-images-settings'],
  { tags: [HOME_CONFIG_CACHE_TAG], revalidate: HOME_CONFIG_REVALIDATE_SECONDS },
)

export const getInstagramSliderSettings = unstable_cache(
  queryInstagramSliderSettings,
  ['home-instagram-slider-settings'],
  { tags: [HOME_CONFIG_CACHE_TAG], revalidate: HOME_CONFIG_REVALIDATE_SECONDS },
)

export const getHomeCategoryCardsSettings = unstable_cache(
  queryHomeCategoryCardsSettings,
  ['home-category-cards-settings'],
  { tags: [HOME_CONFIG_CACHE_TAG], revalidate: HOME_CONFIG_REVALIDATE_SECONDS },
)

export function sanitizeHeroImagesPayload(input: HeroImagesSettingsDTO): HeroImagesSettingsDTO {
  return normalizeHeroImages(input)
}

export function sanitizeInstagramPostsPayload(input: unknown): InstagramPostDTO[] {
  const normalized = normalizeInstagramPosts(input)
  return normalized.length > 0 ? normalized : [...INSTAGRAM_SLIDER_DEFAULTS.posts]
}

export function sanitizeHomeCategoryCardsPayload(
  input: unknown,
): HomeCategoryCardDTO[] {
  const normalized = normalizeCategoryCards(input)
  return normalized.length > 0 ? normalized : [...HOME_CATEGORY_CARDS_DEFAULTS.cards]
}
