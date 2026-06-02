import { NextRequest, NextResponse } from 'next/server'
import {
  ADMIN_AUTH_COOKIE_NAME,
  createAdminSessionToken,
  getAdminSessionCookieOptions,
} from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  const { password } = (await req.json()) as { password: string }

  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD is not configured' },
      { status: 500 }
    )
  }

  if (password !== adminPassword) {
    return NextResponse.json({ error: 'Невірний пароль' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  const token = await createAdminSessionToken()

  res.cookies.set(
    ADMIN_AUTH_COOKIE_NAME,
    token,
    getAdminSessionCookieOptions(),
  )

  return res
}
