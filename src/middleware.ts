import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE_NAME = 'conote_session'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value

  const isAuthRoute = pathname.startsWith('/login') || pathname === '/'
  const isApiAuthRoute = pathname.startsWith('/api/auth')
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/notebook') ||
    pathname.startsWith('/settings')

  // Allow auth API routes to proceed freely
  if (isApiAuthRoute) {
    return NextResponse.next()
  }

  // 1. Unauthenticated users trying to access protected routes -> redirect to /login
  if (!sessionToken && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 2. Authenticated users visiting /login or root / -> redirect to /dashboard
  if (sessionToken && isAuthRoute && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
