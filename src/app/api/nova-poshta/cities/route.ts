import { NextRequest, NextResponse } from 'next/server'
import { npCall } from '@/lib/np'
import {
  buildNpCityQueryVariants,
  dedupeCityOptions,
  normalizeCityComparable,
} from '@/lib/np-city-search'

function norm(s: string) {
  return normalizeCityComparable(s)
}

function typeAbbr(t?: string) {
  const x = (t || '').toLowerCase()
  if (x.includes('місто') || x.includes('город')) return 'м.'
  if (x.includes('селище міського типу') || x.includes('смт')) return 'смт'
  if (x.includes('село')) return 'с.'
  if (x.includes('селище')) return 'сел.'
  return ''
}
function areaAbbr(area?: string) {
  return area ? `${area} обл.` : ''
}
function districtAbbr(region?: string) {
  return region ? `${region} р-н` : ''
}

// Тип відповіді від Нової Пошти
interface NovaPoshtaSettlement {
  Description: string
  SettlementTypeDescription?: string
  AreaDescription?: string
  RegionsDescription?: string
  Region?: string
  Ref: string
}

function readPositiveInt(value: string | null, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function isUnsupportedSearchError(error: unknown) {
  if (!(error instanceof Error)) return false
  return /FindByString is not specified|invalid characters/i.test(error.message)
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const raw = searchParams.get('query') || ''
    const page = readPositiveInt(searchParams.get('page'), 1)
    const limit = Math.min(readPositiveInt(searchParams.get('limit'), 20), 50)

    const q = norm(raw)
    if (q.length < 2) return NextResponse.json({ data: [] })

    const queryVariants = buildNpCityQueryVariants(raw)
    if (!queryVariants.length) return NextResponse.json({ data: [] })

    let data: NovaPoshtaSettlement[] = []

    for (const query of queryVariants) {
      try {
        data = await npCall<NovaPoshtaSettlement[]>(
          'AddressGeneral',
          'getSettlements',
          {
            FindByString: query,
            Warehouse: 1,
            Page: page,
            Limit: limit,
          }
        )

        if (data.length) break
      } catch (error) {
        if (!isUnsupportedSearchError(error)) throw error
      }
    }

    const queryNorms = [q, ...queryVariants.map(norm)]

    const rows = data.map((c) => {
      const name = c.Description
      const type = c.SettlementTypeDescription
      const area = c.AreaDescription
      const region = c.RegionsDescription || c.Region

      const abType = typeAbbr(type)
      const parts = [
        abType ? `${abType} ${name}` : name,
        areaAbbr(area),
        districtAbbr(region),
      ].filter(Boolean)

      return {
        settlementRef: c.Ref,
        name,
        area: area || '',
        type: type || '',
        region: region || '',
        label: parts.join(', '),
        nameN: norm(name),
        typeIsCity: /місто|город/i.test(type || ''),
      }
    })

    const score = (r: (typeof rows)[number]) => {
      let s = 0
      for (const query of queryNorms) {
        if (r.nameN === query) s = Math.max(s, 30)
        if (r.nameN.startsWith(query)) s = Math.max(s, 20)
        if (r.nameN.includes(query)) s = Math.max(s, 10)
      }
      if (r.typeIsCity) s += 1
      return s
    }

    rows.sort((a, b) => score(b) - score(a))

    const unique = dedupeCityOptions(rows)

    return NextResponse.json({ data: unique.slice(0, limit) })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('NP getSettlements error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
