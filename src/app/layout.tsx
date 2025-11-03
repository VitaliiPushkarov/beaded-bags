import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import Header from '../components/Header'
import CartDrawer from '@/components/cart/CartDrawer'
import Footer from '@/components/Footer'

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uk">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link
          rel="icon0"
          href="/icon.svg"
          type="image/<generated>"
          sizes="<generated>"
        />
        <link
          rel="icon1"
          href="/icon.png"
          type="image/<generated>"
          sizes="<generated>"
        />
        <link
          rel="apple-touch-icon"
          href="/apple-icon?<generated>"
          type="image/<generated>"
          sizes="<generated>"
        />
      </head>
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
