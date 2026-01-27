'use client'

import { useEffect, useState } from 'react'
import { PROMO_STORAGE_KEY, readPromoFromStorage } from './promo'

export function usePromo() {
  const [promo, setPromo] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setPromo(readPromoFromStorage())
    sync()

    const onStorage = (e: StorageEvent) => {
      if (e.key === PROMO_STORAGE_KEY) sync()
    }

    const onPromoChanged = () => sync()

    window.addEventListener('storage', onStorage)
    window.addEventListener('gerdan_promo_changed', onPromoChanged)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('gerdan_promo_changed', onPromoChanged)
    }
  }, [])

  return promo
}
