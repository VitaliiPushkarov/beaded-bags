import type { Metadata } from 'next'

// Checkout is a transactional funnel (checkout, /pay, /success). None of these
// pages should ever appear in search results. The success/pay pages are client
// components and cannot export their own metadata, so we noindex the whole
// segment here — this also covers any future checkout sub-routes.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
