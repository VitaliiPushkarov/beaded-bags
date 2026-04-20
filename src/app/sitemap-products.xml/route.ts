import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const revalidate = 3600 // 1 година

function normalizeBaseUrl(url?: string): string {
  if (!url) return 'https://gerdan.online'
  return url.replace(/\/+$/, '')
}

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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}

function isValidSitemapXml(xml: string): boolean {
  if (!xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) return false
  if (!xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')) return false
  if (!xml.includes('</urlset>')) return false
  if (xml.includes('<parsererror')) return false
  return true
}

function xmlResponse(xml: string, fallback = false) {
  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Sitemap-Fallback': fallback ? '1' : '0',
    },
  })
}

export async function GET() {
  const baseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL)
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
        const rawLoc = `${baseUrl}/products/${encodeURIComponent(p.slug)}`
        const loc = escapeXml(rawLoc)
        const lastmod = escapeXml(p.updatedAt.toISOString())

        return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
      })
      .join('')

    const xml = buildSitemapXml(urls)

    if (!isValidSitemapXml(xml)) {
      console.error('Invalid sitemap XML generated for /sitemap-products.xml')
      return xmlResponse(emptyXml, true)
    }

    return xmlResponse(xml)
  } catch (error) {
    console.error('Failed to generate /sitemap-products.xml:', error)
    return xmlResponse(emptyXml, true)
  }
}

export async function HEAD() {
  const xml = buildSitemapXml('')
  return xmlResponse(xml)
}
