import { NextResponse } from 'next/server'
import { getSiteUrl } from '@/lib/site-url'

export const revalidate = 3600

function buildSitemapIndexXml(): string {
  const ukSiteUrl = getSiteUrl('uk')
  const enSiteUrl = getSiteUrl('en')

  const sitemapUrls = [
    `${ukSiteUrl}/sitemap.xml`,
    `${ukSiteUrl}/sitemap-products.xml`,
    `${enSiteUrl}/sitemap.xml`,
    `${enSiteUrl}/sitemap-products.xml`,
  ]

  const nodes = sitemapUrls
    .map(
      (loc) => `  <sitemap>\n    <loc>${loc}</loc>\n  </sitemap>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${nodes}\n</sitemapindex>`
}

export async function GET() {
  const xml = buildSitemapIndexXml()

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
