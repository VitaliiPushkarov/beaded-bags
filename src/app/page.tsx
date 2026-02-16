import dynamic from 'next/dynamic'
import Bestsellers from '@/components/Bestsellers'
import HeroBlock from '@/components/HeroBlock'

const HeroImages = dynamic(() => import('@/components/HeroImages'), {
  loading: () => <section className="h-[520px] md:h-[620px]" />,
})

const ProductsSlider = dynamic(() => import('./products/ProductsSlider'), {
  loading: () => <section className="h-[520px] md:h-[650px]" />,
})

const InstagramSlider = dynamic(() => import('@/components/InstagramSlider'), {
  loading: () => <section className="h-[380px] md:h-[460px]" />,
})

const SITE_URL = 'https://gerdan.online'

export const metadata = {
  alternates: {
    canonical: '/',
  },
}

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
