// Main page

import HeroImages from '@/components/HeroImages'
import Bestsellers from '@/components/Bestsellers'

import Footer from '@/components/Footer'
import ProductsSlider from './products/ProductsSlider'

import Vision from '@/components/Vision'
import About from '@/components/About'

export default function Home() {
  return (
    <>
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
