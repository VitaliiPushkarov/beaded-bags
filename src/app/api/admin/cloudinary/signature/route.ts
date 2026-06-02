import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireAdmin } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin(req)
  if (unauthorized) return unauthorized

  const { folder } = (await req.json().catch(() => ({}))) as {
    folder?: string
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'Cloudinary env is not configured' },
      { status: 500 },
    )
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const safeFolder = folder?.trim() || 'gerdan/products'

  // Important: sign EXACT params you will send to Cloudinary.
  const toSign = `folder=${safeFolder}&timestamp=${timestamp}${apiSecret}`
  const signature = crypto.createHash('sha1').update(toSign).digest('hex')

  return NextResponse.json({
    cloudName,
    apiKey,
    timestamp,
    folder: safeFolder,
    signature,
  })
}
