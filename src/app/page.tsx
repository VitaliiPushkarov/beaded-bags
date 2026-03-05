import dynamic from 'next/dynamic'
import Bestsellers from '@/components/Bestsellers'
import HeroBlock from '@/components/HeroBlock'
import type { Metadata } from 'next'
import CategorySection from '@/components/CategorySection'

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

export const metadata: Metadata = {
  title: 'Сумки ручної роботи, аксесуари та чохли з бісеру',
  description:
    'GERDAN — сумки ручної роботи, сумки з бісеру, плетені сумки, чохли та брелоки. Каталог українського бренду аксесуарів.',
  keywords: [
    'сумки ручної роботи',
    'сумки з бісеру',
    'плетені сумки',
    'чохли з бісеру',
    'брелоки',
    'аксесуари',
  ],
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
    sameAs: ['https://www.instagram.com/gerdan.studio/'],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+380955837060',
        contactType: 'customer support',
        areaServed: 'UA',
        availableLanguage: ['uk'],
      },
    ],
  }

  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'GERDAN — сумки ручної роботи та аксесуари',
    url: SITE_URL,
    description:
      'Сумки ручної роботи, сумки з бісеру, плетені сумки, чохли та аксесуари українського бренду GERDAN.',
    inLanguage: 'uk',
    isPartOf: {
      '@type': 'WebSite',
      name: 'GERDAN',
      url: SITE_URL,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <h1 className="sr-only">
        Сумки ручної роботи, сумки з бісеру та аксесуари GERDAN
      </h1>
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
      <CategorySection />
      {/* <About image="/img/about-section-preview.png" alt="Про нас" /> */}
    </>
  )
}
