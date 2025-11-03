/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://gerdan.online',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  changefreq: 'weekly',
  priority: 0.8,
  exclude: ['/api/*', '/checkout/*'],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/checkout/'],
      },
    ],
    additionalSitemaps: ['https://gerdan.online/sitemap.xml'],
  },
}
