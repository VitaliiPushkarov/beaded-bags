/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://gerdan.online',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  changefreq: 'weekly',
  priority: 0.8,

  exclude: [
    '/api/*',
    '/checkout*',
    '/cart',
    '/cashback',
    '/manifest.json',
    '/icon*',
    '/_next/*',
  ],

  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/checkout', '/cart', '/cashback'],
      },
    ],
    additionalSitemaps: [
      'https://gerdan.online/sitemap.xml',
      'https://gerdan.online/sitemap-0.xml',
    ],
  },
}
