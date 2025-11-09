import { NextRequest, NextResponse } from 'next/server'

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

  // Set admin-auth cookie for 7 days
  res.cookies.set('admin-auth', 'true', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return res
}
