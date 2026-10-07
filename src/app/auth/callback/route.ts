import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const next = requestUrl.searchParams.get('next') || '/dashboard'
  const origin = requestUrl.origin

  // 1. If Google or provider returned an OAuth error
  if (error) {
    console.error('OAuth Callback Error:', error)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
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
        const googleId = googleIdentity?.id || user.user_metadata?.provider_id || user.user_metadata?.sub || null
        const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User'
        const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null

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
