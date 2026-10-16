import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  hashToken,
  createSession,
  getSessionAndUser,
  revokeSession,
  UserRecord,
} from '@/lib/db'
import { createClient as createServerSupabase, isSupabaseConfigured } from '@/lib/supabase/server'
import { signSessionToken, verifySessionToken } from '@/lib/auth/token'

export const SESSION_COOKIE_NAME = 'conote_session'
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 days

export async function getCurrentUser(): Promise<UserRecord | null> {
  // 1. If Supabase is configured, check authenticated Supabase session
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabase()
      const { data: { user }, error } = await supabase.auth.getUser()

      if (user && !error) {
        const googleIdentity = user.identities?.find(i => i.provider === 'google')
        const googleId = googleIdentity?.id || (user.user_metadata?.sub as string) || user.id
        const name = (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User') as string
        const avatarUrl = (user.user_metadata?.avatar_url || user.user_metadata?.picture || null) as string | null

        return {
          id: user.id,
          google_sub: googleId,
          email: user.email || '',
          email_verified: Boolean(user.email_confirmed_at || user.confirmed_at || true),
          name,
          avatar_url: avatarUrl,
          created_at: user.created_at,
          updated_at: user.updated_at || user.created_at,
          last_active_at: new Date().toISOString(),
          deleted_at: null,
        }
      }
    } catch (err) {
      console.error('[getCurrentUser Supabase Error]', err)
    }
  }

  // 2. Check local/fallback session cookie
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) return null

  // A. Fast, reliable stateless cryptographic token verification
  const payload = await verifySessionToken(token)
  if (payload) {
    return {
      id: payload.sub,
      google_sub: `local:${payload.email}`,
      email: payload.email,
      email_verified: true,
      name: payload.name,
      avatar_url: payload.avatar_url || null,
      created_at: new Date(payload.iat * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      deleted_at: null,
    }
  }

  // B. Fallback for legacy database tokens
  try {
    const tokenHash = hashToken(token)
    const result = await getSessionAndUser(tokenHash)
    if (result?.user) {
      return result.user
    }
  } catch (err) {
    console.error('[getCurrentUser Local Session Error]', err)
  }

  // If token is invalid or expired, clear it to prevent redirect loops
  try {
    cookieStore.delete(SESSION_COOKIE_NAME)
  } catch {}

  return null
}

export async function requireAuth(): Promise<UserRecord> {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

export async function createAndSetSession(
  userId: string,
  userDetails?: { email: string; name: string; avatar_url?: string | null }
): Promise<string> {
  const token = await signSessionToken(
    {
      sub: userId,
      email: userDetails?.email || 'user@notebook.app',
      name: userDetails?.name || 'Notebook User',
      avatar_url: userDetails?.avatar_url || null,
    },
    SESSION_MAX_AGE_SECONDS
  )

  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)

  // Best-effort database session persistence
  await createSession(userId, tokenHash, expiresAt).catch((err) => {
    console.warn('[createSession DB non-fatal warning]', err?.message)
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: expiresAt,
  })

  return token
}

export async function clearSession(): Promise<void> {
  // If Supabase is active, sign out from Supabase
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabase()
      await supabase.auth.signOut()
    } catch (err) {
      console.error('[clearSession Supabase Error]', err)
    }
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    try {
      const tokenHash = hashToken(token)
      await revokeSession(tokenHash)
    } catch (err) {
      console.error('[clearSession Error]', err)
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
