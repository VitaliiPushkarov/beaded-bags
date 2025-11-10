import { NextRequest, NextResponse } from 'next/server'
import { getProducts } from '@/lib/db/products'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const sp = url.searchParams

    const search = sp.get('q') || undefined
    const type = sp.get('type') || undefined
    const color = sp.get('color') || undefined

    const limitParam = sp.get('limit')
    const limit = limitParam ? Number(limitParam) || undefined : undefined

    const items = await getProducts({ search, type, color })

    const sliced =
      typeof limit === 'number' ? items.slice(0, Math.max(0, limit)) : items

    return NextResponse.json(sliced)
  } catch (err) {
    console.error('GET /api/products error', err)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
