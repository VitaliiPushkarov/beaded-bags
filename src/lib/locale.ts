export type Locale = 'uk' | 'en'

export const DEFAULT_LOCALE: Locale = 'uk'

export function detectLocaleFromHost(host: string | null): Locale {
  if (!host) return DEFAULT_LOCALE
  if (host.startsWith('ca.')) return 'en'
  return 'uk'
}
