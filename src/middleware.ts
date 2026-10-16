import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { verifySessionToken } from '@/lib/auth/token'

const SESSION_COOKIE_NAME = 'conote_session'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const isSupabaseConfigured = Boolean(
    supabaseUrl &&
    !supabaseUrl.includes('your-project') &&
    !supabaseUrl.includes('placeholder') &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('your-anon-key')
  )

  const isAuthCallback = pathname.startsWith('/auth')
  const isApiAuthRoute = pathname.startsWith('/api/auth')

  // Allow auth API routes and OAuth callback to proceed freely
  if (isApiAuthRoute || isAuthCallback) {
    return NextResponse.next()
  }

  // 1. If Supabase is configured, refresh session and handle Supabase auth state
  if (isSupabaseConfigured) {
    const supabaseResponse = await updateSession(request)
    if (supabaseResponse.headers.get('location')) {
      return supabaseResponse
    }
  }

  // 2. Local/stateless session validation
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const isAuthRoute = pathname.startsWith('/login') || pathname === '/'
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/notebook') ||
    pathname.startsWith('/settings')

  let hasValidToken = false
  if (sessionToken) {
    const payload = await verifySessionToken(sessionToken)
    hasValidToken = Boolean(payload)
  }

  // If visiting protected route with no valid token or an invalid token
  if (!hasValidToken && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const res = NextResponse.redirect(url)
    if (sessionToken && !hasValidToken) {
      // Clear corrupt/expired cookie to break redirect loops
      res.cookies.delete(SESSION_COOKIE_NAME)
    }
    return res
  }

  // If visiting /login or root with a valid token -> send directly to dashboard
  if (hasValidToken && isAuthRoute && pathname === '/login') {
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
