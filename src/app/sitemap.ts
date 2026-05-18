import type { MetadataRoute } from 'next'
import { getBlogPosts } from '@/lib/blog'
import { getAccessorySubcategorySlugs } from '@/lib/shop-taxonomy'
import { getSiteUrl } from '@/lib/site-url'

export const revalidate = 3600
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ukSiteUrl = getSiteUrl('uk')
  const enSiteUrl = getSiteUrl('en')
  const accessorySubcategories = getAccessorySubcategorySlugs()
  const blogPosts = await getBlogPosts()

  const staticPages = [
    '/',
    '/sale',
    '/shop',
    '/shop/sumky',
    '/shop/bananky',
    '/shop/shopery',
    '/shop/chohly',
    '/shop/accessories',
    ...accessorySubcategories.map((slug) => `/shop/accessories/${slug}`),
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
    url: `${ukSiteUrl}${path}`,
    alternates: {
      languages: {
        uk: `${ukSiteUrl}${path}`,
        en: `${enSiteUrl}${path}`,
        'x-default': `${ukSiteUrl}${path}`,
      },
    },
    changeFrequency: path === '/' ? 'daily' : 'weekly',
    priority: path === '/' ? 1 : path.startsWith('/shop') ? 0.9 : 0.8,
  }))

  const blogEntries: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${ukSiteUrl}/blog/${post.slug}`,
    alternates: {
      languages: {
        uk: `${ukSiteUrl}/blog/${post.slug}`,
        en: `${enSiteUrl}/blog/${post.slug}`,
        'x-default': `${ukSiteUrl}/blog/${post.slug}`,
      },
    },
    lastModified: new Date(post.updatedAt),
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...staticEntries, ...blogEntries]
}
