import { NextRequest, NextResponse } from 'next/server'
import { npCall } from '@/lib/np'

interface NovaPoshtaWarehouse {
  Ref: string
  Number: string
  Description?: string
  ShortAddress?: string
  CategoryOfWarehouse?: string
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // сумісність: якщо ще десь передається cityRef — використаємо його як settlementRef
    const settlementRef =
      searchParams.get('settlementRef') || searchParams.get('cityRef')
    const query = (searchParams.get('query') || '').trim()
    const page = Number(searchParams.get('page') || 1)
    const limit = Number(searchParams.get('limit') || 100)

    if (!settlementRef) return NextResponse.json({ data: [] })

    const data = await npCall<NovaPoshtaWarehouse[]>(
      'AddressGeneral',
      'getWarehouses',
      {
        SettlementRef: settlementRef,
        FindByString: query || undefined,
        Page: page,
        Limit: Math.min(limit, 200),
      }
    )

    const warehouses = data.map((w) => {
      const number = w.Number
      const raw = (w.ShortAddress || w.Description || '').trim()
      const afterCity = raw.replace(/^м\..*?,\s*/i, '') // прибрати "м. місто,"

      const isPostomat = w.CategoryOfWarehouse === 'Postomat'

      const rest = afterCity || (w.Description || '').replace(/^[^,]+,\s*/, '')
      const label = `${isPostomat ? 'Поштомат' : '№'}${
        isPostomat ? ` ${number}` : number
      }, ${rest}`.replace(/\s+,/g, ',')

      return {
        ref: w.Ref,
        number,
        address: rest,
        isPostomat,
        label,
      }
    })

    return NextResponse.json({ data: warehouses })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'NP getWarehouses failed'
    console.error('NP getWarehouses error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
