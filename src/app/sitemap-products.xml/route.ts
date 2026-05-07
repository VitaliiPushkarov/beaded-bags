import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSiteUrl } from '@/lib/site-url'

export const revalidate = 3600 // 1 година

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildSitemapXml(urls: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`
}

function isValidSitemapXml(xml: string): boolean {
  if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) return false
  if (
    !xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
  )
    return false
  if (!xml.includes('</urlset>')) return false
  if (xml.includes('<parsererror')) return false
  return true
}

function xmlResponse(
  xml: string,
  options?: { fallback?: boolean; status?: number; retryAfterSeconds?: number },
) {
  const fallback = options?.fallback ?? false
  const status = options?.status ?? 200
  return new NextResponse(xml, {
    status,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Sitemap-Fallback': fallback ? '1' : '0',
      ...(options?.retryAfterSeconds
        ? { 'Retry-After': String(options.retryAfterSeconds) }
        : {}),
    },
  })
}

export async function GET() {
  const ukBaseUrl = getSiteUrl('uk')
  const enBaseUrl = getSiteUrl('en')
  const emptyXml = buildSitemapXml('')

  try {
    const products = await prisma.product.findMany({
      where: {
        status: 'PUBLISHED',
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    })

    const urls = products
      .map((p) => {
        const ukLocRaw = `${ukBaseUrl}/products/${encodeURIComponent(p.slug)}`
        const enLocRaw = `${enBaseUrl}/products/${encodeURIComponent(p.slug)}`
        const loc = escapeXml(ukLocRaw)
        const enLoc = escapeXml(enLocRaw)
        const lastmod = escapeXml(p.updatedAt.toISOString())

        return `
  <url>
    <loc>${loc}</loc>
    <xhtml:link rel="alternate" hreflang="uk" href="${loc}" />
    <xhtml:link rel="alternate" hreflang="en" href="${enLoc}" />
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
      })
      .join('')

    const xml = buildSitemapXml(urls)

    if (!isValidSitemapXml(xml)) {
      console.error('Invalid sitemap XML generated for /sitemap-products.xml')
      return xmlResponse(emptyXml, {
        fallback: true,
        status: 503,
        retryAfterSeconds: 300,
      })
    }

    return xmlResponse(xml)
  } catch (error) {
    console.error('Failed to generate /sitemap-products.xml:', error)
    return xmlResponse(emptyXml, {
      fallback: true,
      status: 503,
      retryAfterSeconds: 300,
    })
  }
}

export async function HEAD() {
  const xml = buildSitemapXml('')
  return xmlResponse(xml)
}
