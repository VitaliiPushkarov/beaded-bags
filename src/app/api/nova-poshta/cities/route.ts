import { NextRequest, NextResponse } from 'next/server'
import { npCall } from '@/lib/np'

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const raw = searchParams.get('query') || ''
    const page = Number(searchParams.get('page') || 1)
    const limit = Math.min(Number(searchParams.get('limit') || 20), 50)

    const q = norm(raw)
    if (q.length < 2) return NextResponse.json({ data: [] })

    const data = await npCall<NovaPoshtaSettlement[]>(
      'AddressGeneral',
      'getSettlements',
      {
        FindByString: raw,
        Warehouse: 1,
        Page: page,
        Limit: limit,
      }
    )

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

    const qn = q
    const score = (r: (typeof rows)[number]) => {
      let s = 0
      if (r.nameN === qn) s += 30
      if (r.nameN.startsWith(qn)) s += 20
      if (r.nameN.includes(qn)) s += 10
      if (r.typeIsCity) s += 1
      return s
    }

    rows.sort((a, b) => score(b) - score(a))

    const seen = new Set<string>()
    const unique = rows.filter((r) => {
      const key = `${r.area}|${r.name}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return NextResponse.json({ data: unique.slice(0, 12) })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('NP getSettlements error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
