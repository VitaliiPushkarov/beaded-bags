import type { Locale } from './locale'

const FALLBACK_SITE_URLS: Record<Locale, string> = {
  uk: 'https://gerdan.online',
  en: 'https://en.gerdan.online',
}

export function normalizeBaseUrl(url?: string | null): string {
  if (!url) return FALLBACK_SITE_URLS.uk
  return url.replace(/\/+$/, '')
}

export function getSiteUrl(locale: Locale = 'uk'): string {
  if (locale === 'en') {
    return normalizeBaseUrl(
      process.env.NEXT_PUBLIC_SITE_URL_EN ??
        process.env.NEXT_PUBLIC_EN_SITE_URL ??
        FALLBACK_SITE_URLS.en,
    )
  }

  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_SITE_URL_UK ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      FALLBACK_SITE_URLS.uk,
  )
}

export function toAbsoluteUrl(path: string, locale: Locale = 'uk'): string {
  if (/^https?:\/\//i.test(path)) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getSiteUrl(locale)}${normalizedPath}`
}

export function getLocaleAlternates(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return {
    canonical: normalizedPath,
    languages: {
      uk: `${getSiteUrl('uk')}${normalizedPath}`,
      en: `${getSiteUrl('en')}${normalizedPath}`,
    },
  }
}
