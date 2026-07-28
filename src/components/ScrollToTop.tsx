'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Guarantees a new page opens at the top. Next's App Router usually scrolls to
// top on navigation, but async/deferred content (e.g. the ssr:false product
// gallery and lazily-loaded images) plus route loading states can leave the
// window at the previous position. Resetting on pathname change makes the
// behaviour deterministic. Keyed on pathname only, so in-page query changes
// (e.g. ?variant= selection, filters) don't jump the page; a URL hash is
// respected so anchor links still work.
export default function ScrollToTop() {
  const pathname = usePathname()

  useEffect(() => {
    if (window.location.hash) return
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
