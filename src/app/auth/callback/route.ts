import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const next = requestUrl.searchParams.get('next') || '/dashboard'
  const origin = requestUrl.origin

  // 1. If user cancelled or provider returned an OAuth error
  if (error) {
    console.error('OAuth Callback Error:', error, errorDescription)
    const errType = error === 'access_denied' || errorDescription?.includes('denied') ? 'cancelled' : 'auth_failed'
    return NextResponse.redirect(`${origin}/login?error=${errType}`)
  }

  // 2. Exchange authorization code for Supabase authenticated session
  if (code) {
    try {
      const supabase = await createClient()
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('Supabase exchangeCodeForSession error:', exchangeError)
        return NextResponse.redirect(`${origin}/login?error=auth_failed`)
      }

      const user = data.user
      if (user) {
        // Extract Google profile metadata
        const googleIdentity = user.identities?.find(i => i.provider === 'google')
        const googleId = googleIdentity?.id || (user.user_metadata?.provider_id as string) || (user.user_metadata?.sub as string) || null
        const name = (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User') as string
        const avatarUrl = (user.user_metadata?.avatar_url || user.user_metadata?.picture || null) as string | null

        // Upsert user profile into database
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            google_id: googleId,
            name,
            email: user.email?.toLowerCase() || '',
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(),
          }, { onConflict: 'id' })
      }
    } catch (err) {
      console.error('OAuth Callback Exception:', err)
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }
  }

  // 3. Open Redirect Protection: strictly ensure next is an internal relative route
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  return NextResponse.redirect(`${origin}${safeNext}`)
}
