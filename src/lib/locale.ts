export type Locale = 'uk' | 'en'

export const DEFAULT_LOCALE: Locale = 'uk'

export function detectLocaleFromHost(host: string | null): Locale {
  if (!host) return DEFAULT_LOCALE
  const normalized = host.toLowerCase().replace(/:\d+$/, '')
  if (normalized.startsWith('ca.') || normalized.startsWith('en.')) return 'en'
  return 'uk'
}
