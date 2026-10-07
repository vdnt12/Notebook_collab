import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const isAuthCallback = request.nextUrl.pathname.startsWith('/auth')
  const isLoginPage = request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project')) {
    return supabaseResponse
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    // Refreshes session if expired and retrieves authenticated user
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Unauthenticated users trying to access protected routes -> redirect to /login
    if (!user && !isAuthCallback && !isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // 2. Authenticated users visiting /login or / -> redirect to /dashboard
    if (user && isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  } catch (err) {
    console.error('Supabase middleware session error:', err)
  }

  return supabaseResponse
}
