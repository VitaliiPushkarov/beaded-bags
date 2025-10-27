import { NextResponse } from 'next/server'
import { npCall } from '@/lib/np'

export async function GET() {
  try {
    const data = await npCall<any[]>('Address', 'getAreas', {})
    const areas = data.map((a) => ({ ref: a.Ref, name: a.Description }))
    return NextResponse.json({ data: areas })
  } catch (e: any) {
    console.error('NP getAreas error:', e?.message || e)
    return NextResponse.json(
      { error: e?.message || 'NP error' },
      { status: 500 }
    )
  }
}
