import type { MetadataRoute } from 'next'
import { getBlogPosts } from '@/lib/blog'

export const revalidate = 3600

function normalizeBaseUrl(url?: string): string {
  if (!url) return 'https://gerdan.online'
  return url.replace(/\/+$/, '')
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL)
  const now = new Date()

  const staticPages = [
    '/',
    '/shop',
    '/shop/sumky',
    '/shop/bananky',
    '/shop/rjukzachky',
    '/shop/shopery',
    '/shop/chohly',
    '/shop/prykrasy',
    '/shop/accessories',
    '/shop/group/beads',
    '/shop/group/weaving',
    '/about',
    '/info',
    '/contacts',
    '/oferta',
    '/policy',
    '/cashback',
    '/blog',
  ]

  const staticEntries: MetadataRoute.Sitemap = staticPages.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'daily' : 'weekly',
    priority: path === '/' ? 1 : path.startsWith('/shop') ? 0.9 : 0.8,
  }))

  const blogEntries: MetadataRoute.Sitemap = getBlogPosts().map((post) => ({
    url: `${siteUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...staticEntries, ...blogEntries]
}
