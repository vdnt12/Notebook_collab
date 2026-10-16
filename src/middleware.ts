import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const SESSION_COOKIE_NAME = 'conote_session'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const isSupabaseConfigured = Boolean(
    supabaseUrl &&
    !supabaseUrl.includes('your-project') &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('your-anon-key')
  )

  const isAuthCallback = pathname.startsWith('/auth')
  const isApiAuthRoute = pathname.startsWith('/api/auth')

  // Allow auth API routes and OAuth callback to proceed freely
  if (isApiAuthRoute || isAuthCallback) {
    return NextResponse.next()
  }

  if (isSupabaseConfigured) {
    return await updateSession(request)
  }

  // Local fallback mode when Supabase is not configured
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const isAuthRoute = pathname.startsWith('/login') || pathname === '/'
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/notebook') ||
    pathname.startsWith('/settings')

  if (!sessionToken && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

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
