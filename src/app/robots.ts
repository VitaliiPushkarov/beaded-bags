import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  const ukSiteUrl = getSiteUrl('uk')
  const enSiteUrl = getSiteUrl('en')

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
    sitemap: [
      `${ukSiteUrl}/sitemap_index.xml`,
      `${ukSiteUrl}/sitemap.xml`,
      `${ukSiteUrl}/sitemap-products.xml`,
      `${enSiteUrl}/sitemap_index.xml`,
      `${enSiteUrl}/sitemap.xml`,
      `${enSiteUrl}/sitemap-products.xml`,
    ],
  }
}
