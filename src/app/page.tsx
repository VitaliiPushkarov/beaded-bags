import HeroImages from '@/components/HeroImages'
import Bestsellers from '@/components/Bestsellers'

import ProductsSlider from './products/ProductsSlider'

import Vision from '@/components/Vision'
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
          leftImg="/img/hero-img-1.png"
          centerVideo="/media/hero-vid.mov"
          centerPoster="/img/hero-img-2.png"
          rightImg="/img/hero-img-3.png"
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
      <Vision />
      <Bestsellers />
      {/*  <section className="max-w-6xl mx-auto px-4 py-12 ">
        <h3 className="text-2xl font-semibold mb-5">Каталог</h3>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {PRODUCTS.slice(0, 4).map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section> */}
      <ProductsSlider />
      <About image="/img/about-section-preview.png" alt="Про нас" />
    </>
  )
}
