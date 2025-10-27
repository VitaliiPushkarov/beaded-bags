import { NextRequest, NextResponse } from 'next/server'
import { npCall } from '@/lib/np'
import { any } from 'zod'

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

    const data = await npCall<any[]>('AddressGeneral', 'getWarehouses', {
      SettlementRef: settlementRef,
      FindByString: query || undefined,
      Page: page,
      Limit: Math.min(limit, 200),
    })

    const warehouses = data.map((w, any) => {
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
  } catch (e: any) {
    console.error('NP getWarehouses error:', e?.message || e)
    return NextResponse.json(
      { error: e?.message || 'NP getWarehouses failed' },
      { status: 500 }
    )
  }
}
