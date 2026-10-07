import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  generateSessionToken,
  hashToken,
  createSession,
  getSessionAndUser,
  revokeSession,
  UserRecord,
} from '@/lib/db'

export const SESSION_COOKIE_NAME = 'conote_session'
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 days

export async function getCurrentUser(): Promise<UserRecord | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) return null

  try {
    const tokenHash = hashToken(token)
    const result = await getSessionAndUser(tokenHash)
    if (!result) return null
    return result.user
  } catch (err) {
    console.error('[getCurrentUser Error]', err)
    return null
  }
}

export async function requireAuth(): Promise<UserRecord> {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

export async function createAndSetSession(userId: string): Promise<string> {
  const rawToken = generateSessionToken()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)

  await createSession(userId, tokenHash, expiresAt)

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: expiresAt,
  })

  return rawToken
}

export async function clearSession(): Promise<void> {
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
