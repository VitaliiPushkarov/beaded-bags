import { getPostOrderPromo } from '@/lib/promo-server'

import SuccessClient from './SuccessClient'

// Rendered per request so the promo shown after checkout always reflects what
// is configured in /admin/promo, with no deploy needed to change it.
export const dynamic = 'force-dynamic'

export default async function SuccessPage() {
  const promo = await getPostOrderPromo()

  return <SuccessClient promo={promo} />
}
