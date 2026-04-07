import type { MetadataRoute } from 'next'

function normalizeBaseUrl(url?: string): string {
  if (!url) return 'https://gerdan.online'
  return url.replace(/\/+$/, '')
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL)

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/cart',
          '/checkout',
          '/login',
          '/success',
          // Prevent crawl budget waste on faceted catalog URLs.
          '/shop?*',
          '/shop/*?*',
        ],
      },
    ],
    host: siteUrl,
    sitemap: [`${siteUrl}/sitemap.xml`, `${siteUrl}/sitemap-products.xml`],
  }
}
