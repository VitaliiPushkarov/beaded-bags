import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import Header from '../components/Header'
import CartDrawer from '@/components/cart/CartDrawer'
import Footer from '@/components/Footer'
import { SpeedInsights } from '@vercel/speed-insights/next'
import Script from 'next/script'
import type { Metadata } from 'next'

const SITE_URL = 'https://gerdan.online'

export const metadata: Metadata = {
  title: {
    default: 'GERDAN — Сумки з бісеру, шопери та аксесуари ручної роботи',
    template: '%s | GERDAN',
  },
  description:
    'Інтернет-магазин GERDAN — сучасні сумки з бісеру, шопери та аксесуари ручної роботи. Український бренд із душею.',
  metadataBase: new URL('https://gerdan.online'),
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'GERDAN — Сумки з бісеру та аксесуари ручної роботи',
    description:
      'Сучасні аксесуари ручної роботи. Купуйте українське — підтримуйте ремесло.',
    url: 'https://gerdan.online',
    siteName: 'GERDAN',
    locale: 'uk_UA',
    type: 'website',
    images: ['https://gerdan.online/icon1.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GERDAN — Сумки з бісеру та аксесуари ручної роботи',
    description:
      'Сучасні аксесуари ручної роботи. Купуйте українське — підтримуйте ремесло.',
    images: ['https://gerdan.online/icon1.png'],
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
        {/* JSON-LD WebSite */}
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }}
        />
        {/* Google Tag Manager */}
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-PDGBFQDW');`}
        </Script>
        {/* Google Tag Manager */}
      </head>

      <body className="min-h-screen text-gray-900 antialiased bg-white font-fixel">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-PDGBFQDW"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>

        <SpeedInsights />
        <Header />
        <main className="max-w-full mx-auto">{children}</main>
        <Analytics />
        <CartDrawer />
        <Footer />
      </body>
    </html>
  )
}
