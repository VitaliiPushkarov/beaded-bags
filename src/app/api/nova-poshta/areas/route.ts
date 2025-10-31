import { NextResponse } from 'next/server'
import { npCall } from '@/lib/np'

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
    console.error('NP getAreas error:', error)
    return NextResponse.json({ error }, { status: 500 })
  }
}
