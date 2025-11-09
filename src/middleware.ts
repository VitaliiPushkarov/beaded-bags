import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // If not accessing /admin, continue
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  const loggedIn = req.cookies.get('admin-auth')?.value === 'true'
  const isLoginPage = pathname.startsWith('/admin/login')

  // If not logged in and not on /admin/login → redirect
  if (!loggedIn && !isLoginPage) {
    const url = req.nextUrl.clone()
    url.pathname = '/admin/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  // if logged in and on /admin/login → redirect to /admin
  if (loggedIn && isLoginPage) {
    const url = req.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
