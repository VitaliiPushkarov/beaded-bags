import Link from 'next/link'
import Image from 'next/image'

const HOME_CATEGORY_CARDS = [
  {
    title: 'Сумки',
    href: '/shop/sumky',
    image: '/img/home-banner-v-day.webp',
    subtitle: 'Сумки ручної роботи',
  },
  {
    title: 'Бананки',
    href: '/shop/bananky',
    image: '/img/bananka-waffle-banana-00.jpg',
    subtitle: 'Компактний формат на щодень',
  },
  {
    title: 'Шопери',
    href: '/shop/shopery',
    image: '/img/shopper-lazy.jpg',
    subtitle: 'Місткі моделі для міста',
  },
  {
    title: 'Чохли',
    href: '/shop/chohly',
    image: '/img/metallic-case.jpg',
    subtitle: 'Практичні акценти',
  },
  {
    title: 'Аксесуари',
    href: '/shop/accessories',
    image: '/img/fortune-brelok-01.jpg',
    subtitle: 'Брелоки, гердани, силянки',
  },
] as const
export default function CategorySection() {
  return (
    <section className="max-w-[1440px] px-5 md:px-6 py-12">
      <div className="flex items-end justify-between gap-4 mb-4">
        <h2 className="text-2xl uppercase font-semibold">КАТЕГОРІЇ ТОВАРІВ</h2>
        <Link
          href="/shop"
          className="text-sm underline underline-offset-2 hover:no-underline"
        >
          Всі товари
        </Link>
      </div>
      <div className="md:w-[50%] ">
        <p className="text-gray-700 leading-relaxed mb-6">
          У каталозі GERDAN представлені сумки ручної роботи, сумки з бісеру,
          плетені сумки, чохли та аксесуари для щоденних і акцентних образів.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {HOME_CATEGORY_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group relative overflow-hidden border border-gray-300 min-h-[320px] lg:min-h-[360px] shadow-[0_10px_24px_rgba(0,0,0,0.14)] transition-shadow duration-300 hover:shadow-[0_16px_30px_rgba(0,0,0,0.2)]"
          >
            <Image
              src={card.image}
              alt={card.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/15 to-black/55 transition-colors duration-300 group-hover:from-black/20 group-hover:via-black/25 group-hover:to-black/65" />

            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/80 mb-1">
                {card.subtitle}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-medium">{card.title}</span>
                <span className="text-xl transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
