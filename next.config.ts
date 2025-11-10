import type { NextConfig } from 'next'

const I18NConfig = {
  i18n: {
    locales: ['uk', 'en'],
    defaultLocale: 'uk',

    domains: [
      {
        domain: 'gerdan.online',
        defaultLocale: 'uk',
      },
      {
        domain: 'ca.gerdan.online',
        defaultLocale: 'en',
      },
    ],
  },
}
const nextConfig: NextConfig = {
  transpilePackages: ['swiper'],
  ...I18NConfig,
}

export default nextConfig
