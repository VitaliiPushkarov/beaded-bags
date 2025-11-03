import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import Header from '../components/Header'
import CartDrawer from '@/components/cart/CartDrawer'
import Footer from '@/components/Footer'

const SITE_URL = 'https://gerdan.online'

export const metadata = {
  title: {
    default: 'GERDAN — Сумки з бісеру, шопери та аксесуари ручної роботи',
    template: '%s | GERDAN',
  },
  description:
    'Інтернет-магазин GERDAN — сучасні сумки з бісеру, шопери та аксесуари ручної роботи. Український бренд із душею.',
  metadataBase: new URL('https://gerdan.online'),
  openGraph: {
    title: 'GERDAN — Сумки з бісеру та аксесуари ручної роботи',
    description:
      'Сучасні аксесуари ручної роботи. Купуйте українське — підтримуйте ремесло.',
    url: 'https://gerdan.online',
    siteName: 'GERDAN',
    locale: 'uk_UA',
    type: 'website',
  },
  alternates: {
    canonical: '/',
  },
}

const WEBSITE_JSONLD = {
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uk">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon0.svg" type="image/svg+xml" />
        <link rel="icon" href="/icon1.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180" />
      </head>
      {/* JSON-LD WebSite */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }}
      />
      <body className="min-h-screen text-gray-900 antialiased bg-white font-fixel">
        <Header />
        <main className="max-w-full mx-auto md:py-8">{children}</main>
        <Analytics />
        <CartDrawer />
        <Footer />
      </body>
    </html>
  )
}
