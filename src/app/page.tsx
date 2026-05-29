import dynamic from 'next/dynamic'
import NewArrivals from '@/components/NewArrivals'
import HeroBlock from '@/components/HeroBlock'
import type { Metadata } from 'next'
import CategorySection from '@/components/CategorySection'
import { getRequestLocale } from '@/lib/server-locale'
import SpecialOffers from '@/components/SpecialOffers'
import { getLocaleAlternates, getSiteUrl } from '@/lib/site-url'
import {
  getHeroImagesSettings,
  getInstagramSliderSettings,
} from '@/lib/home-page-config'

const HeroImages = dynamic(() => import('@/components/HeroImages'), {
  loading: () => <section className="h-[520px] md:h-[620px]" />,
})

const ProductsSlider = dynamic(() => import('./products/ProductsSlider'), {
  loading: () => <section className="h-[520px] md:h-[650px]" />,
})

const InstagramSlider = dynamic(() => import('@/components/InstagramSlider'), {
  loading: () => <section className="h-[380px] md:h-[460px]" />,
})

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  return {
    title:
      locale === 'en'
        ? 'Handmade Bags, Accessories and Beaded Cases'
        : 'Сумки ручної роботи, аксесуари та чохли з бісеру',
    description:
      locale === 'en'
        ? 'GERDAN - handmade bags, beaded bags, woven bags, cases and accessories.'
        : 'GERDAN — сумки ручної роботи, сумки з бісеру, плетені сумки, чохли та брелоки. Каталог українського бренду аксесуарів.',
    keywords:
      locale === 'en'
        ? [
            'handmade bags',
            'beaded bags',
            'woven bags',
            'beaded cases',
            'keychains',
            'accessories',
          ]
        : [
            'сумки ручної роботи',
            'сумки з бісеру',
            'плетені сумки',
            'чохли з бісеру',
            'брелоки',
            'аксесуари',
          ],
    alternates: getLocaleAlternates('/'),
  }
}

export default async function Home() {
  const locale = await getRequestLocale()
  const siteUrl = getSiteUrl(locale)
  const heroImages = await getHeroImagesSettings()
  const instagram = await getInstagramSliderSettings()
  const isEn = locale === 'en'
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'GERDAN',
    url: siteUrl,
    logo: `${siteUrl}/gerdan.svg`,
    sameAs: ['https://www.instagram.com/gerdan.studio/'],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+380955837060',
        contactType: 'customer support',
        areaServed: 'UA',
        availableLanguage: isEn ? ['en', 'uk'] : ['uk'],
      },
    ],
  }

  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: isEn
      ? 'GERDAN - handmade bags and accessories'
      : 'GERDAN — сумки ручної роботи та аксесуари',
    url: siteUrl,
    description: isEn
      ? 'Handmade bags, beaded bags, woven bags, cases and accessories by GERDAN.'
      : 'Сумки ручної роботи, сумки з бісеру, плетені сумки, чохли та аксесуари українського бренду GERDAN.',
    inLanguage: isEn ? 'en' : 'uk',
    isPartOf: {
      '@type': 'WebSite',
      name: 'GERDAN',
      url: siteUrl,
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
        {isEn
          ? 'Handmade bags, beaded bags and accessories by GERDAN'
          : 'Сумки ручної роботи, сумки з бісеру та аксесуари GERDAN'}
      </h1>
      <HeroBlock />
      <NewArrivals />

      <>
        <HeroImages
          leftImg={heroImages.leftImg}
          centerVideo={heroImages.centerVideo}
          centerPoster={heroImages.centerPoster}
          rightImg={heroImages.rightImg}
          altLeft={heroImages.altLeft}
          altRight={heroImages.altRight}
        />
      </>
      <SpecialOffers />

      <ProductsSlider />
      <InstagramSlider posts={instagram.posts} />
      <CategorySection />
      {/* <About image="/img/about-section-preview.png" alt="Про нас" /> */}
    </>
  )
}
