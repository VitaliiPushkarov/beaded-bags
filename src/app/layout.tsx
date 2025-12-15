import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import Header from '../components/Header'
import CartDrawer from '@/components/cart/CartDrawer'
import Footer from '@/components/Footer'
import { SpeedInsights } from '@vercel/speed-insights/next'
import Script from 'next/script'

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
    image: 'https://gerdan.online/icon1.png',
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
        <link rel="canonical" href="https://gerdan.online/" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon0.svg" type="image/svg+xml" />
        <link rel="icon" href="/icon1.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180" />
        {/* JSON-LD WebSite */}
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }}
        />
        {/* Meta Pixel */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '3697388910529281');
            fbq('track', 'PageView');
          `}
        </Script>

        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=3697388910529281&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
      </head>

      <body className="min-h-screen text-gray-900 antialiased bg-white font-fixel">
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
