import { NextRequest, NextResponse } from 'next/server'
import { npCall } from '@/lib/np'

interface NovaPoshtaWarehouse {
  Ref: string
  Number: string
  Description?: string
  ShortAddress?: string
  CategoryOfWarehouse?: string
  TypeOfWarehouseRef?: string
}

// офіційний тип поштоматів у НП
const POSTOMAT_TYPE_REF = 'f9316480-5f2d-425d-bc2c-ac7cd29decf0'

// робимо ОДИН запит з великим лімітом
const MAX_LIMIT = 500

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const settlementRef =
      searchParams.get('settlementRef') || searchParams.get('cityRef')
    const query = (searchParams.get('query') || '').trim()

    if (!settlementRef) return NextResponse.json({ data: [] })

    // ---- 1. один запит до НП з Limit = 500 ----
    const data = await npCall<NovaPoshtaWarehouse[]>(
      'AddressGeneral',
      'getWarehouses',
      {
        SettlementRef: settlementRef,
        FindByString: query || undefined,
        Page: 1,
        Limit: MAX_LIMIT,
      }
    )

    // ---- 2. мапимо + визначаємо поштомати ----
    const warehouses = data.map((w) => {
      const number = w.Number

      const rawDesc = (w.Description || '').trim()
      const rawShort = (w.ShortAddress || '').trim()
      const rawCategory = (w.CategoryOfWarehouse || '').trim().toLowerCase()

      // прибираємо "м. Київ," на початку короткої адреси
      const afterCity = rawShort.replace(/^м\..*?,\s*/i, '')

      const isPostomat =
        w.TypeOfWarehouseRef === POSTOMAT_TYPE_REF ||
        /postomat|поштомат/i.test(rawCategory) ||
        /postomat|поштомат/i.test(rawDesc)

      const rest =
        afterCity || rawDesc.replace(/^[^,]+,\s*/, '') || rawDesc || rawShort

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
