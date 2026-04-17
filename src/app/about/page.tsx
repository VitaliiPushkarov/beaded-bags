import Image from 'next/image'
import type { Metadata } from 'next'
import { Skeleton } from '@/components/ui/Skeleton'
import { getRequestLocale } from '@/lib/server-locale'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  return {
    title: locale === 'en' ? 'About us' : 'Про нас',
    description:
      locale === 'en'
        ? 'GERDAN is a Ukrainian accessories brand that preserves craft spirit in contemporary forms.'
        : 'GERDAN — бренд українських аксесуарів, що зберігає дух ремесла у формі сьогодення.',
    alternates: {
      canonical: '/about',
    },
  }
}

export default async function AboutPage() {
  const locale = await getRequestLocale()
  const isEn = locale === 'en'

  const paragraphs = isEn
    ? [
        'We are a brand from the heart of Ukraine, from the city of Kropyvnytskyi.',
        'GERDAN is about Ukrainian culture, craft spirit, and beauty.',
        'For generations, women created beadwork by hand and passed it on as heritage.',
        'Each thread has its own story, each bead carries a piece of soul.',
        'We preserve the memory of Ukrainian craft in modern accessory forms.',
        'Every bag is a small collection meant to stay in your memories.',
      ]
    : [
        'Ми — бренд із серця України, з маленького міста Кропивницький.',
        'Власниця Лера і майстриня Таня, які люблять створювати красу своїми руками.',
        'Ґердан — це про українську культуру, дух та красу.',
        'Століттями наші бабусі створювали прикраси своїми руками та передавали це, як спадщину з покоління в покоління. Колись ґерданом жінки оберігали себе, розповідали про свій рід, про любов і свої мрії.',
        'У кожній нитці своя історія, у кожній намистині — частинка душі.',
        'Наш бренд пропонує закарбувати пам\'ять про українське ремесло у формах сьогодення.',
        'Створюючи сучасні аксесуари, ми не просто прикрашаємо — ми відроджуємо традицію носити силу, жіночність і тепло у деталях, що не старіють із часом.',
        'Кожна сумка — маленька колекція, що буде гріти душу та залишить свій яскравий слід у спогадах цього покоління.',
      ]
  return (
    <div className="relative lg:h-[2445px] 2xl:h-full">
      {/* Фон */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="relative block h-full w-full md:hidden">
          <Image
            src="/img/about-bg-m.png"
            alt="GERDAN background texture mobile"
            fill
            quality={80}
            className="object-cover"
          />
        </div>
        <div className="relative hidden h-full w-full md:block">
          <Image
            src="/img/about-bg.jpg"
            alt="GERDAN background texture"
            fill
            quality={80}
            sizes="(max-width: 768px) 100vw,
         (max-width: 1200px) 100vw,
         100vw"
            className="object-cover"
          />
        </div>
      </div>
      <div className=" flex min-h-screen flex-col gap-20 lg:gap-0">
        {/* Верхній блок: логотип + слогани */}
        <section className="lg:h-[758px] mt-[147px] h-full ">
          <div className="flex flex-col items-center  gap-6 text-center lg:gap-[62px] px-10 md:px-0 2xl:mx-auto">
            <Image
              src="/img/about-us-gerdan.png"
              alt="GERDAN logo"
              width={895}
              height={85}
              className="lg:w-[895px] lg:h-[85px] 2xl:w-[1440px] 2xl:h-[104px]"
              priority
            />

            <Image
              src="/img/about-us-text.png"
              alt="BEADED BAGS WITH A SOUL"
              width={898}
              height={291}
              className="lg:w-[898px] lg:h-[291px] 2xl:w-[1440px] 2xl:h-[467px]"
            />
          </div>
        </section>

        {/* Основний контент: текст + фото */}
        <section className="flex flex-col justify-between 2xl:justify-center 2xl:mt-[120px] lg:flex-row lg:-mt-[200px] gap-10 ">
          {/* Ліва колонка: текст ABOUT US */}
          <div className="flex flex-col text-white px-10 lg:max-w-[610px] gap-9 lg:gap-[52px] lg:pt-20 ">
            <h1 className="text-3xl md:text-[51px] leading-[1.2] font-bold">
              ABOUT US
            </h1>

            <div className="space-y-4 text-lg  md:text-[20px] leading-tight tracking-tighter">
              {paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>

          {/* Права колонка: картка з сумкою */}

          <div className="relative aspect-3/4 lg:w-[825px] lg:h-[1015px] overflow-hidden bg-white/95 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <Skeleton className="absolute inset-0" />
            <Image
              src="/img/about-us-img.png"
              alt="Beaded bag GERDAN"
              fill
              className="object-cover"
            />
          </div>
        </section>

        {/* Нижній слоган */}
        <section className="relative w-full px-6 md:px-0 flex justify-center items-center md:mx-auto lg:mt-[180px] lg:mb-[180px]">
          {/* Mobile version */}
          <div className="relative w-full min-h-[180px] md:hidden">
            <Image
              src="/img/about-us-footer-text.png"
              alt="BEADED BAGS WITH A SOUL"
              fill
              className="object-contain"
            />
          </div>

          {/* Tablet / Desktop version */}
          <div className="relative hidden md:block lg:h-[270px] lg:w-[1010px] 2xl:w-[1400px] 2xl:h-[360px]">
            <Image
              src="/img/about-us-footer-text.png"
              alt="BEADED BAGS WITH A SOUL"
              fill
              className="object-contain lg:object-cover"
            />
          </div>
        </section>
      </div>
    </div>
  )
}
