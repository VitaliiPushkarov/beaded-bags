import { NextRequest, NextResponse } from 'next/server'
import { isNovaPoshtaTransientError, npCall } from '@/lib/np'

interface NovaPoshtaWarehouse {
  Ref: string
  Number: string
  Description?: string
  ShortAddress?: string
  CategoryOfWarehouse?: string
  TypeOfWarehouse?: string
  TypeOfWarehouseRef?: string
}

// офіційний тип поштоматів у НП
const POSTOMAT_TYPE_REF = 'f9316480-5f2d-425d-bc2c-ac7cd29decf0'

// робимо ОДИН запит з великим лімітом
const MAX_LIMIT = 500

function readPositiveInt(value: string | null, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function normalizeWarehouseQuery(value: string) {
  return value
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s'"№.,/-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const settlementRef =
      searchParams.get('settlementRef') || searchParams.get('cityRef')
    const query = normalizeWarehouseQuery(searchParams.get('query') || '')
    const requestedLimit = readPositiveInt(searchParams.get('limit'), MAX_LIMIT)
    const limit = Math.min(requestedLimit, MAX_LIMIT)

    if (!settlementRef) return NextResponse.json({ data: [] })

    // ---- 1. один запит до НП з обмеженим Limit ----
    const data = await npCall<NovaPoshtaWarehouse[]>(
      'AddressGeneral',
      'getWarehouses',
      {
        SettlementRef: settlementRef,
        FindByString: query || undefined,
        Page: 1,
        Limit: limit,
      }
    )

    // ---- 2. мапимо + визначаємо поштомати ----
    const warehouses = (Array.isArray(data) ? data : []).map((w) => {
      const number = w.Number

      const rawDesc = (w.Description || '').trim()
      const rawShort = (w.ShortAddress || '').trim()
      const rawCategory = (w.CategoryOfWarehouse || '').trim().toLowerCase()

      // прибираємо "м. Київ," на початку короткої адреси
      const afterCity = rawShort.replace(/^м\..*?,\s*/i, '')

      const isPostomat =
        w.TypeOfWarehouse === POSTOMAT_TYPE_REF ||
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
    if (isNovaPoshtaTransientError(e)) {
      console.warn('NP getWarehouses temporarily unavailable:', message)
      return NextResponse.json({ data: [], unavailable: true })
    }

    console.error('NP getWarehouses error:', message)
    return NextResponse.json(
      { error: 'Nova Poshta warehouses lookup failed' },
      { status: 502 },
    )
  }
}
