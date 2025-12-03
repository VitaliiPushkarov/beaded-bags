'use client'

import { useEffect, useRef, useState } from 'react'
import { useCheckout } from '@/stores/checkout'

const POPULAR_CITY_NAMES = [
  'Київ',
  'Львів',
  'Одеса',
  'Харків',
  'Дніпро',
  'Запоріжжя',
  'Івано-Франківськ',
  'Тернопіль',
  'Чернівці',
  'Рівне',
  'Луцьк',
  'Полтава',
  'Чернігів',
  'Черкаси',
  'Суми',
  'Житомир',
  'Ужгород',
  'Миколаїв',
  'Херсон',
]

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

  const [whLoading, setWhLoading] = useState(false)

  // місто
  const [qCity, setQCity] = useState(np.cityName || '')
  const [cities, setCities] = useState<City[]>([])
  const [activeCityIdx, setActiveCityIdx] = useState(-1)
  const [cityOpen, setCityOpen] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)

  // відділення
  const [allWh, setAllWh] = useState<WH[]>([]) // повний кеш міста
  const [wh, setWh] = useState<WH[]>([]) // відфільтрований список
  const [qWh, setQWh] = useState('')
  const [activeWhIdx, setActiveWhIdx] = useState(-1)
  const [loadingWh, setLoadingWh] = useState(false)
  const [whOpen, setWhOpen] = useState(false)

  const whInputRef = useRef<HTMLInputElement>(null)

  const hasCity = !!np.cityRef // тут cityRef = SettlementRef

  useEffect(() => {
    if (!cityOpen) return // не відкритий дропдаун – не спамимо API

    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      const q = qCity
        .normalize('NFC')
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .trim()

      if (!q) {
        setCities([])
        setActiveCityIdx(-1)
        return
      }

      try {
        setLoadingCities(true)
        const params = new URLSearchParams({ query: q, limit: '20' })
        params.set('warehouses', '1')
        const res = await fetch(
          `/api/nova-poshta/cities?${params.toString()}`,
          { signal: ctrl.signal }
        )
        if (!res.ok) {
          console.error('NP cities failed:', await res.text())
          setCities([])
          return
        }
        const json = await res.json()
        setCities(Array.isArray(json.data) ? (json.data as City[]) : [])
        setActiveCityIdx(-1)
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError') {
          console.error('NP cities fetch error:', e)
          setCities([])
        }
      } finally {
        setLoadingCities(false)
      }
    }, 300) // debounce

    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [qCity, cityOpen])

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
    setCityOpen(false) // закриваємо дропдаун міста

    setTimeout(() => whInputRef.current?.focus(), 0)
  }
  async function quickPickPopularCity(name: string) {
    try {
      setLoadingCities(true)
      const params = new URLSearchParams({ query: name, limit: '1' })
      params.set('warehouses', '1')

      const res = await fetch(`/api/nova-poshta/cities?${params.toString()}`)
      if (!res.ok) {
        console.error('NP quick city failed:', await res.text())
        setQCity(name)
        setCityOpen(true)
        return
      }

      const json = await res.json()
      const list: City[] = Array.isArray(json.data) ? json.data : []
      const c = list[0]

      if (c) {
        const ref = c.settlementRef ?? c.ref!
        pickCity(c.name, ref)
      } else {
        // якщо з якоїсь причини не знайшли — просто підставимо в рядок і дамо юзеру обрати
        setQCity(name)
        setCityOpen(true)
      }
    } catch (e: unknown) {
      console.error('NP quick city error:', e)
      setQCity(name)
      setCityOpen(true)
    } finally {
      setLoadingCities(false)
    }
  }

  useEffect(() => {
    const ctrl = new AbortController()
    ;(async () => {
      // скидаємо локальні стейти відділень
      setAllWh([])
      setWh([])
      setQWh('')
      setActiveWhIdx(-1)
      setWhLoading(false)

      if (!np.cityRef) return

      try {
        setWhLoading(true)
        const url = `/api/nova-poshta/warehouses?settlementRef=${np.cityRef}&limit=200`
        const res = await fetch(url, { signal: ctrl.signal })
        if (!res.ok) {
          console.error('NP warehouses failed:', await res.text())
          return
        }
        const json = await res.json()
        const list: WH[] = Array.isArray(json.data) ? json.data : []

        const hydrated = list.map((w) => ({
          ...w,
          label:
            w.label ??
            `${w.isPostomat ? 'Поштомат ' : '№'}${w.number}, ${w.address}`,
        }))

        setAllWh(hydrated)
        setWh(hydrated.slice(0, 50))
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError') {
          console.error('NP warehouses fetch error:', e)
        }
      } finally {
        setWhLoading(false)
      }
    })()
    return () => ctrl.abort()
  }, [np.cityRef])

  // ───────────────────────────────────────────────────────────
  // ЛОКАЛЬНА ФІЛЬТРАЦІЯ ВІДДІЛЕНЬ
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!np.cityRef) return

    const q = qWh.trim()
    // якщо поле порожнє — показуємо перші 50 з кешу міста
    if (!q) {
      setWh(allWh.slice(0, 50))
      setActiveWhIdx(-1)
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      const normalized = q.toLowerCase()
      const digits = normalized.replace(/\D/g, '')

      // якщо юзер явно шукає конкретне відділення / поштомат —
      // робимо ЗАПИТ НА БЕКЕНД з query
      const shouldRemote =
        digits.length >= 3 ||
        normalized.includes('поштомат') ||
        normalized.includes('postomat')

      if (shouldRemote) {
        try {
          setLoadingWh(true)
          const params = new URLSearchParams({
            settlementRef: np.cityRef!,
            query: q,
            limit: '50',
          })
          const res = await fetch(
            `/api/nova-poshta/warehouses?${params.toString()}`,
            { signal: controller.signal }
          )
          if (!res.ok) {
            console.error('NP warehouses search failed:', await res.text())
            return
          }
          const json = await res.json()
          const list: WH[] = Array.isArray(json.data) ? json.data : []

          const hydrated = list.map((w) => ({
            ...w,
            label:
              w.label ??
              `${w.isPostomat ? 'Поштомат ' : '№'}${w.number}, ${w.address}`,
          }))

          setWh(hydrated)
          setActiveWhIdx(hydrated.length ? 0 : -1)
        } catch (e: unknown) {
          if (e instanceof Error && e.name !== 'AbortError') {
            console.error('NP warehouses remote search error:', e)
          }
        } finally {
          setLoadingWh(false)
        }
      } else {
        // Інакше — легкий локальний пошук по кешу
        const filtered = allWh.filter((w) => {
          const haystack = `${w.number} ${w.label ?? ''} ${
            w.address
          }`.toLowerCase()
          return haystack.includes(normalized)
        })
        setWh(filtered.slice(0, 100))
        setActiveWhIdx(filtered.length ? 0 : -1)
      }
    }, 300) // debounce

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [qWh, allWh, np.cityRef])
  useEffect(() => {
    if (!whOpen) return
    const t = setTimeout(() => whInputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [whOpen])

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
    setWhOpen(false) // close dropdown
  }

  return (
    <div className="space-y-4">
      {/* City */}
      <div className="relative">
        {/* Button */}
        <div className="mt-1 relative">
          <button
            type="button"
            onClick={() => {
              setWhOpen(false) // ✨ Закриваємо Відділення
              setCityOpen(!cityOpen) // Відкриваємо Місто
              setQCity(np.cityName || '')
              setActiveCityIdx(-1)
            }}
            className="mt-1 flex w-full items-center justify-between  border-b pr-3 py-2 text-left text-[12px]"
          >
            <span className={np.cityName ? 'text-black' : 'text-gray-400'}>
              {np.cityName || 'ОБЕРІТЬ МІСТО*'}
            </span>

            {/* стрілка ▼ / ▲ */}
            <span
              className={
                'ml-2 inline-block w-0 h-0 border-l-[6px] border-r-[6px] border-l-transparent border-r-transparent ' +
                (cityOpen
                  ? 'border-t-0 border-t-8px border-t-black' // ▲
                  : 'border-b-0 border-b-8px border-b-black') // ▼
              }
            />
          </button>

          {/* DROPDOWN поверх, щільно прилягає */}
          {cityOpen && (
            <div className="absolute left-0 right-0 top-full z-30 max-h-72 overflow-auto border-x border-b border-black bg-white">
              {/* інпут пошуку у дропдауні */}
              <div className="px-3 pt-2 pb-2 border-b border-black/10">
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
                  placeholder="Введіть назву міста"
                  className="w-full text-sm outline-none placeholder:tracking-[0.12em] placeholder:uppercase placeholder:text-gray-400"
                />
              </div>

              {/* city list */}
              {loadingCities ? (
                <div className="px-3 py-4 text-sm text-gray-500">
                  Завантаження...
                </div>
              ) : cities.length > 0 ? (
                cities.map((c, i) => {
                  const cityKey = c.settlementRef ?? c.ref!
                  const active = i === activeCityIdx
                  return (
                    <button
                      key={cityKey}
                      type="button"
                      className={
                        'block w-full text-left px-3 py-3 text-sm cursor-pointer ' +
                        (active ? 'bg-black text-white' : 'hover:bg-gray-50')
                      }
                      onMouseEnter={() => setActiveCityIdx(i)}
                      onMouseLeave={() => setActiveCityIdx(-1)}
                      onClick={() =>
                        pickCity(c.name, c.settlementRef ?? c.ref!)
                      }
                    >
                      <div className="font-semibold">{c.name}</div>
                      {c.label && (
                        <div
                          className={
                            active
                              ? 'text-white/80 text-xs mt-1'
                              : 'text-gray-600 text-xs mt-1'
                          }
                        >
                          {c.label}
                        </div>
                      )}
                    </button>
                  )
                })
              ) : (
                <>
                  {POPULAR_CITY_NAMES.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => quickPickPopularCity(name)}
                    >
                      {name}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Відділення / поштомат */}
      <div>
        <div className="mt-1 relative">
          {/* button */}
          <button
            type="button"
            onClick={() => {
              if (!hasCity) return // якщо місто не вибране — нічого не робимо
              setCityOpen(false)
              setWhOpen((prev) => !prev)
            }}
            className="flex w-full items-center justify-between border-b pr-3 py-2 text-[12px]"
          >
            <span className={np.warehouseText ? 'text-black' : 'text-gray-400'}>
              {np.warehouseText || 'ОБЕРІТЬ ВІДДІЛЕННЯ*'}
            </span>

            {/* стрілочка ▼ / ▲ */}
            <span
              className={
                'ml-2 inline-block w-0 h-0 border-l-[6px] border-r-[6px] border-l-transparent border-r-transparent ' +
                (whOpen
                  ? 'border-t-0 border-t-8px border-t-black' // ▲
                  : 'border-b-0 border-b-8px border-b-black') // ▼
              }
            />
          </button>

          {/* Dropdown */}
          {whOpen && hasCity && (
            <div className="absolute left-0 right-0 top-full z-30 max-h-72 overflow-auto border-x border-b border-black bg-white">
              {/* Input in dropdown */}
              <div className="px-3 pt-2 pb-2 border-b border-black/10">
                <input
                  ref={whInputRef}
                  value={qWh}
                  onChange={(e) => {
                    setQWh(e.target.value)
                    setActiveWhIdx(-1)
                  }}
                  onKeyDown={onWhKeyDown}
                  placeholder="Введіть значення для пошуку"
                  className="w-full text-sm outline-none placeholder:tracking-[0.12em] placeholder:uppercase placeholder:text-gray-400"
                />
              </div>

              {loadingWh ? (
                <div className="px-3 py-4 text-sm text-gray-500">
                  Завантаження...
                </div>
              ) : wh.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-500">
                  Відділення не знайдено
                </div>
              ) : (
                wh.map((w, i) => {
                  const active = i === activeWhIdx
                  const label =
                    w.label ??
                    `${w.isPostomat ? 'Поштомат ' : '№'}${w.number}, ${
                      w.address
                    }`

                  return (
                    <button
                      key={w.ref}
                      className={
                        'block w-full text-left px-3 py-3 text-sm cursor-pointer ' +
                        (active ? 'bg-black text-white' : 'hover:bg-gray-50')
                      }
                      onMouseEnter={() => setActiveWhIdx(i)}
                      onMouseLeave={() => setActiveWhIdx(-1)}
                      onClick={() => {
                        pickWarehouse({ ...w, label })
                      }}
                    >
                      <div className="font-semibold">
                        {w.isPostomat
                          ? `Поштомат №${w.number}`
                          : `Відділення №${w.number}`}
                      </div>
                      <div
                        className={
                          active
                            ? 'text-white/80 text-xs mt-1'
                            : 'text-gray-600 text-xs mt-1'
                        }
                      >
                        {w.address}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Підсумок */}
      <div className=" bg-gray-50 p-3 text-sm text-gray-700">
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
