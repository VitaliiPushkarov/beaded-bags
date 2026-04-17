import 'server-only'

import { headers } from 'next/headers'
import { detectLocaleFromHost, type Locale } from './locale'

export async function getRequestLocale(): Promise<Locale> {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  return detectLocaleFromHost(host)
}
