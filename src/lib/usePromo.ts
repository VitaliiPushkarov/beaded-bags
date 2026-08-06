'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  PROMO_CHANGED_EVENT,
  PROMO_STORAGE_KEY,
  emitPromoChanged,
  readPromoFromStorage,
  validatePromoCode,
  writePromoToStorage,
} from './promo'

// Just the stored code, for places that only need to know whether one is set.
export function usePromo() {
  const [promo, setPromo] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setPromo(readPromoFromStorage())
    sync()

    const onStorage = (e: StorageEvent) => {
      if (e.key === PROMO_STORAGE_KEY) sync()
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener(PROMO_CHANGED_EVENT, sync)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(PROMO_CHANGED_EVENT, sync)
    }
  }, [])

  return promo
}

export type AppliedPromo = {
  code: string
  discountPercent: number
  discountUAH: number
}

// The stored code re-validated against the current subtotal. The server owns
// the rules, so a code that expires, runs out or falls below its minimum order
// simply stops applying — the front end knows nothing about promo logic.
export function usePromoDiscount(input: {
  subtotalUAH: number
  locale: 'uk' | 'en'
}) {
  const storedCode = usePromo()
  const [applied, setApplied] = useState<AppliedPromo | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const requestRef = useRef<AbortController | null>(null)

  const { subtotalUAH, locale } = input

  useEffect(() => {
    requestRef.current?.abort()

    if (!storedCode) {
      setApplied(null)
      setMessage(null)
      return
    }

    const controller = new AbortController()
    requestRef.current = controller
    setChecking(true)

    validatePromoCode({
      code: storedCode,
      subtotalUAH,
      locale,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return

        if (result.valid) {
          setApplied({
            code: result.code,
            discountPercent: result.discountPercent,
            discountUAH: result.discountUAH,
          })
          setMessage(null)
          return
        }

        setApplied(null)
        setMessage(result.message ?? null)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        // A network hiccup must not look like an invalid code; the order route
        // re-checks it regardless.
        setApplied(null)
        setMessage(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false)
      })

    return () => controller.abort()
  }, [storedCode, subtotalUAH, locale])

  const remove = useCallback(() => {
    writePromoToStorage(null)
    emitPromoChanged()
  }, [])

  const apply = useCallback((code: string) => {
    writePromoToStorage(code)
    emitPromoChanged()
  }, [])

  return {
    storedCode,
    applied,
    message,
    checking,
    apply,
    remove,
    discountUAH: applied?.discountUAH ?? 0,
    discountPercent: applied?.discountPercent ?? 0,
  }
}
