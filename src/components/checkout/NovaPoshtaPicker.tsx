'use client'

import { useEffect, useRef, useState } from 'react'
import { useCheckout } from '@/stores/checkout'

type City = {
  ref?: string
  settlementRef?: string
  name: string
  area: string
  label?: string
}

type WH = {
  ref: string
  number: string
  address: string
  isPostomat: boolean
  label?: string
}

export default function NovaPoshtaPicker() {
  const np = useCheckout((s) => s.np)
  const setNP = useCheckout((s) => s.setNP)

  // місто
  const [qCity, setQCity] = useState(np.cityName || '')
  const [cities, setCities] = useState<City[]>([])
  const [activeCityIdx, setActiveCityIdx] = useState(-1)

  // відділення
  const [allWh, setAllWh] = useState<WH[]>([]) // повний кеш міста
  const [wh, setWh] = useState<WH[]>([]) // відфільтрований список
  const [qWh, setQWh] = useState('')
  const [activeWhIdx, setActiveWhIdx] = useState(-1)
  const [showWhList, setShowWhList] = useState(false)

  const whInputRef = useRef<HTMLInputElement>(null)

  const hasCity = !!np.cityRef // тут cityRef = SettlementRef

  // ───────────────────────────────────────────────────────────
  // ПОШУК МІСТА (дебаунс + abort + лише ≥2 символи)
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      const q = qCity
        .normalize('NFC')
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .trim()
      if (q.length < 1) {
        setCities([])
        return
      }
      try {
        const params = new URLSearchParams({ query: q, limit: '20' })
        params.set('warehouses', '1')
        const res = await fetch(
          `/api/nova-poshta/cities?${params.toString()}`,
          {
            signal: ctrl.signal,
          }
        )
        if (!res.ok) {
          console.error('NP cities failed:', await res.text())
          setCities([])
          return
        }
        const json = await res.json()
        setCities(Array.isArray(json.data) ? json.data : [])
        setActiveCityIdx(-1)
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          console.error('NP cities fetch error:', e)
          setCities([])
        }
      }
    }, 300)

    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [qCity])

  // клавіатура по містах
  const onCityKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!cities.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveCityIdx((i) => (i + 1) % cities.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveCityIdx((i) => (i - 1 + cities.length) % cities.length)
    } else if (e.key === 'Enter') {
      if (activeCityIdx >= 0) {
        const c = cities[activeCityIdx]
        const ref = c.settlementRef ?? c.ref!
        pickCity(c.name, ref)
      }
    }
  }

  function pickCity(name: string, settlementRef: string) {
    setNP({
      cityRef: settlementRef,
      cityName: name,
      warehouseRef: undefined,
      warehouseText: undefined,
    })
    setQCity(name)
    setCities([])

    setTimeout(() => whInputRef.current?.focus(), 0)
  }

  // ───────────────────────────────────────────────────────────
  // ЗАВАНТАЖИТИ ВСІ ВІДДІЛЕННЯ МІСТА ОДИН РАЗ (limit ~200)
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController()
    ;(async () => {
      // скидаємо локальні стейти відділень
      setAllWh([])
      setWh([])
      setQWh('')
      setActiveWhIdx(-1)

      if (!np.cityRef) return

      try {
        const url = `/api/nova-poshta/warehouses?settlementRef=${np.cityRef}&limit=200`
        const res = await fetch(url, { signal: ctrl.signal })
        if (!res.ok) {
          console.error('NP warehouses failed:', await res.text())
          return
        }
        const json = await res.json()
        const list: WH[] = Array.isArray(json.data) ? json.data : []

        // Підстраховка label, якщо бек ще не форматує
        const hydrated = list.map((w) => ({
          ...w,
          label:
            w.label ??
            `${w.isPostomat ? 'Поштомат ' : '№'}${w.number}, ${w.address}`,
        }))

        setAllWh(hydrated)
        setWh(hydrated.slice(0, 50))
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          console.error('NP warehouses fetch error:', e)
        }
      }
    })()
    return () => ctrl.abort()
  }, [np.cityRef])

  // ───────────────────────────────────────────────────────────
  // ЛОКАЛЬНА ФІЛЬТРАЦІЯ ВІДДІЛЕНЬ
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!np.cityRef) return

    const q = qWh.trim().toLowerCase()
    if (!q) {
      setWh(allWh.slice(0, 50))
      setActiveWhIdx(-1)
      return
    }
    const isDigitsOnly = /^\d+$/.test(q)

    const filtered = allWh.filter((w) => {
      const inNumber = isDigitsOnly ? w.number.includes(q) : false
      const inLabel = (w.label ?? '').toLowerCase().includes(q)
      const inAddr = w.address.toLowerCase().includes(q)
      return inNumber || inLabel || inAddr
    })

    setWh(filtered.slice(0, 100))
    setActiveWhIdx(filtered.length ? 0 : -1)
  }, [qWh, allWh, np.cityRef])

  // клавіатура по відділеннях
  const onWhKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!wh.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveWhIdx((i) => (i + 1) % wh.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveWhIdx((i) => (i - 1 + wh.length) % wh.length)
    } else if (e.key === 'Enter') {
      if (activeWhIdx >= 0) {
        const w = wh[activeWhIdx]
        pickWarehouse(w)
      }
    }
  }

  function pickWarehouse(w: WH) {
    const lbl =
      w.label ?? `${w.isPostomat ? 'Поштомат ' : '№'}${w.number}, ${w.address}`
    setNP({ warehouseRef: w.ref, warehouseText: lbl })
    setQWh(lbl)
    setWh([]) // сховати список
    setShowWhList(false) // close list
  }

  return (
    <div className="space-y-4">
      {/* Місто */}
      <div>
        <label className="text-sm text-gray-600">Місто</label>
        <input
          value={qCity}
          onChange={(e) => {
            setQCity(e.target.value)
            setActiveCityIdx(-1)
            if (np.cityName !== e.target.value) {
              setNP({
                cityRef: undefined,
                warehouseRef: undefined,
                warehouseText: undefined,
              })
            }
          }}
          onKeyDown={onCityKeyDown}
          placeholder="Виберіть своє місто"
          className="mt-1 w-full rounded border px-3 py-2 outline-none"
        />

        {cities.length > 0 && !hasCity && (
          <div className="mt-2 max-h-64 overflow-auto rounded border bg-white">
            {cities.map((c, i) => {
              const cityKey = c.settlementRef ?? c.ref!
              const active = i === activeCityIdx
              return (
                <button
                  key={cityKey}
                  className={
                    'block w-full text-left px-3 py-2 transition ' +
                    (active ? 'bg-black text-white' : 'hover:bg-gray-50')
                  }
                  onMouseEnter={() => setActiveCityIdx(i)}
                  onMouseLeave={() => setActiveCityIdx(-1)}
                  onClick={() => pickCity(c.name, c.settlementRef ?? c.ref!)}
                >
                  <div className="font-medium">{c.name}</div>
                  {c.label && (
                    <div
                      className={
                        active
                          ? 'text-white/80 text-xs'
                          : 'text-gray-500 text-xs'
                      }
                    >
                      {c.label}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Відділення / поштомат */}
      <div>
        <label className="text-sm text-gray-600">Відділення / поштомат</label>
        <input
          ref={whInputRef}
          value={qWh}
          onChange={(e) => {
            setQWh(e.target.value)
            setActiveWhIdx(-1)
            setShowWhList(true)
          }}
          onKeyDown={onWhKeyDown}
          disabled={!hasCity}
          placeholder={
            hasCity ? 'Введіть № або адресу' : 'Спочатку оберіть місто'
          }
          className="mt-1 w-full rounded border px-3 py-2 outline-none disabled:bg-gray-100 cursor-pointer"
        />

        {showWhList && wh.length > 0 && (
          <div className="mt-2 max-h-72 overflow-auto rounded border bg-white">
            {wh.map((w, i) => {
              const active = i === activeWhIdx
              const label =
                w.label ??
                `${w.isPostomat ? 'Поштомат ' : '№'}${w.number}, ${w.address}`
              return (
                <button
                  key={w.ref}
                  className={
                    'block w-full text-left px-3 py-2 cursor-pointer transition ' +
                    (active ? 'bg-black text-white' : 'hover:bg-gray-50')
                  }
                  onMouseEnter={() => setActiveWhIdx(i)}
                  onMouseLeave={() => setActiveWhIdx(-1)}
                  onClick={() => pickWarehouse({ ...w, label })}
                >
                  <div className="font-medium">{label}</div>
                  {w.isPostomat && (
                    <div
                      className={
                        active
                          ? 'text-white/80 text-xs'
                          : 'text-gray-500 text-xs'
                      }
                    >
                      Поштомат
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Підсумок */}
      <div className="rounded bg-gray-50 p-3 text-sm text-gray-700">
        <div>
          Місто: <b>{np.cityName || '—'}</b>
        </div>
        <div>
          Відділення: <b>{np.warehouseText || '—'}</b>
        </div>
      </div>
    </div>
  )
}
