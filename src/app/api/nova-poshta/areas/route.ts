import { NextResponse } from 'next/server'
import { isNovaPoshtaTransientError, npCall } from '@/lib/np'

interface NovaPoshtaArea {
  Ref: string
  Description: string
}

export async function GET() {
  try {
    const data = await npCall<NovaPoshtaArea[]>('Address', 'getAreas', {})
    const areas = data.map((a) => ({ ref: a.Ref, name: a.Description }))
    return NextResponse.json({ data: areas })
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Unknown error'
    if (isNovaPoshtaTransientError(e)) {
      console.warn('NP getAreas temporarily unavailable:', error)
      return NextResponse.json({ data: [], unavailable: true })
    }

    console.error('NP getAreas error:', error)
    return NextResponse.json(
      { error: 'Nova Poshta areas lookup failed' },
      { status: 502 },
    )
  }
}
