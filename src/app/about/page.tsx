import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Про нас — GERDAN',
  description:
    'GERDAN — бренд українських аксесуарів, що зберігає дух ремесла у формі сьогодення.',
}

export default function AboutPage() {
  return (
    <div className="relative lg:h-[2445px]">
      {/* Фон */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <Image
          src="/img/about-us-bg.webp"
          alt="GERDAN background texture"
          fill
          priority
          className="object-cover"
        />
      </div>
      <div className=" flex min-h-screen flex-col gap-20 lg:gap-0">
        {/* Верхній блок: логотип + слогани */}
        <section className="lg:h-[758px] mt-[147px] h-full ">
          <div className="flex flex-col items-center gap-6 text-center lg:gap-[62px] px-10 md:px-0">
            <Image
              src="/img/about-us-gerdan.png"
              alt="GERDAN logo"
              width={895}
              height={85}
              className="lg:w-[895px] lg:h-[85px]"
              priority
            />

            <Image
              src="/img/about-us-text.png"
              alt="BEADED BAGS WITH A SOUL"
              width={898}
              height={291}
              className="lg:w-[898px] lg:h-[291px]"
              priority
            />
          </div>
        </section>

        {/* Основний контент: текст + фото */}
        <section className="flex flex-col justify-between lg:flex-row lg:-mt-[200px] gap-10">
          {/* Ліва колонка: текст ABOUT US */}
          <div className="flex flex-col text-white px-10 lg:max-w-[641px] gap-9 lg:gap-[52px] lg:pt-20 2xl:px-20 2xl:max-w-full">
            <h2 className="text-[51px] leading-[1.2] font-bold">ABOUT US</h2>

            <div className="space-y-4 text-sm  text-[20px] leading-relaxed">
              <p>
                Ми — бренд із серця України, з маленького міста Кропивницький.
              </p>
              <p>
                Власниця Лера і майстриня Таня, які люблять створювати красу
                своїми руками.
              </p>
              <p>Ґердан — це про українську культуру, дух та красу.</p>
              <p>
                Століттями наші бабусі створювали прикраси своїми руками та
                передавали їх з покоління в покоління. Колись ґерданом жінки
                оберігали себе, розповідали про свій рід, про любов і свої мрії.
              </p>
              <p>
                У кожній нитці своя історія, у кожній намистині — частинка душі.
              </p>
              <p>
                Наш бренд пропонує закарбувати пам&apos;ять про українське
                ремесло у формах сьогодення.
              </p>
              <p>
                Ми створюємо аксесуари, які не просто доповнюють образ, а
                продовжують традицію — через колір, фактуру, деталі, ручну
                роботу та символіку.
              </p>
              <p>
                Кожна сумка — маленька колекція, що буде гріти душу та залишить
                свій яскравий слід у спогадах цього покоління.
              </p>
            </div>
          </div>

          {/* Права колонка: картка з сумкою */}

          <div className="relative aspect-3/4 2xl:w-[1500px] lg:w-[825px] lg:h-[1015px]  bg-white/95  shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <Image
              src="/img/about-us-img.png"
              alt="Beaded bag GERDAN"
              fill
              priority
              className="object-cover"
            />
          </div>
        </section>

        {/* Нижній слоган */}
        <section className="relative w-full min-h-[260px] px-10 md:px-0 lg:h-[247px] lg:w-[960px] flex justify-center items-center md:mx-auto lg:mt-[180px]">
          <Image
            src="/img/about-us-footer-text.png"
            alt="BEADED BAGS WITH A SOUL"
            fill
            className="object-contain
            lg:object-cover"
            priority
          />
        </section>
      </div>
    </div>
  )
}
