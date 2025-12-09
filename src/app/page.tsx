import HeroImages from '@/components/HeroImages'
import Bestsellers from '@/components/Bestsellers'
import ProductsSlider from './products/ProductsSlider'
import HeroBlock from '@/components/HeroBlock'
import InstagramSlider from '@/components/InstagramSlider'

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
        availableLanguage: ['uk'],
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
      <HeroBlock />
      <Bestsellers />

      <>
        <HeroImages
          leftImg="/img/hero-img-1.webp"
          centerVideo="/media/hero-video.mp4"
          centerPoster="/img/hero-img-2.webp"
          rightImg="/img/rightImg.jpg"
          altLeft="Beaded bag on rock"
          altRight="Model with beaded bag"
        />
      </>

      <ProductsSlider />
      <InstagramSlider />
      {/* <About image="/img/about-section-preview.png" alt="Про нас" /> */}
    </>
  )
}
