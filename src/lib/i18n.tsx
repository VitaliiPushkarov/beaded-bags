'use client'

import { createContext, useContext } from 'react'
import type { Locale } from './locale'

const LocaleContext = createContext<Locale>('uk')

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale {
  return useContext(LocaleContext)
}

export function useT() {
  const locale = useLocale()
  return <T,>(uk: T, en: T): T => (locale === 'en' ? en : uk)
}

export function useLocaleNumberFormat(): string {
  const locale = useLocale()
  return locale === 'en' ? 'en-US' : 'uk-UA'
}
