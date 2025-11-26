import HeroImages from '@/components/HeroImages'
import Bestsellers from '@/components/Bestsellers'

import ProductsSlider from './products/ProductsSlider'

import About from '@/components/About'

const SITE_URL = 'https://gerdan.online'

export default function Home() {
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'GERDAN',
    url: SITE_URL,
    logo: `${SITE_URL}/gerdan.svg`,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+380955837060',
        contactType: 'customer support',
        areaServed: 'UA',
        availableLanguage: ['uk', 'ru'],
        sameAs: 'https://www.instagram.com/gerdan.studio/',
      },
    ],
  }

  const webSiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'GERDAN',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/shop?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      {/* JSON-LD скрипти */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
      />
      <>
        <HeroImages
          leftImg="/img/hero-img-1.webp"
          centerVideo="/media/hero-vid.mov"
          centerPoster="/img/hero-img-2.webp"
          rightImg="/img/hero-img-3.webp"
          altLeft="Beaded bag on rock"
          altRight="Model with beaded bag"
        />
      </>
      {/* <CallToAction
        image="/img/cta-banner.png"
        title="GERDAN"
        subtitle="Ручні сумки з бісеру"
        ctaLabel="Дивитися колекцію"
        ctaHref="/products"
      /> */}
      {/* <Vision /> */}
      <Bestsellers />

      <ProductsSlider />
      <About image="/img/about-section-preview.png" alt="Про нас" />
    </>
  )
}
