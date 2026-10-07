import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { upsertGoogleUser } from '@/lib/db'
import { createAndSetSession } from '@/lib/auth/session'

const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
const oauth2Client = new OAuth2Client(googleClientId)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { credential } = body

    if (!credential || typeof credential !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid authentication credential.' },
        { status: 400 }
      )
    }

    if (!googleClientId) {
      console.error('[Google Auth] GOOGLE_CLIENT_ID is not configured in environment variables.')
      return NextResponse.json(
        { error: 'Google authentication is not properly configured on server.' },
        { status: 500 }
      )
    }

    // Cryptographically verify ID token with Google's official public keys
    const ticket = await oauth2Client.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    })

    const payload = ticket.getPayload()
    if (!payload) {
      return NextResponse.json(
        { error: 'Unable to verify Google token payload.' },
        { status: 401 }
      )
    }

    // Verify issuer
    const issuer = payload.iss
    if (issuer !== 'accounts.google.com' && issuer !== 'https://accounts.google.com') {
      return NextResponse.json(
        { error: 'Invalid token issuer.' },
        { status: 401 }
      )
    }

    // Extract verified claims
    const googleSub = payload.sub
    const email = payload.email
    const emailVerified = Boolean(payload.email_verified)
    const name = payload.name || payload.given_name || email?.split('@')[0] || 'User'
    const avatarUrl = payload.picture || null

    if (!googleSub || !email) {
      return NextResponse.json(
        { error: 'Google credential missing required user identity claims.' },
        { status: 400 }
      )
    }

    // Upsert user in PostgreSQL
    const user = await upsertGoogleUser({
      googleSub,
      email,
      emailVerified,
      name,
      avatarUrl,
    })

    // Create server-side session and set HTTP-only cookie
    await createAndSetSession(user.id)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url,
      },
    })
  } catch (error: any) {
    console.error('[Google Auth Verification Error]', error?.message || error)
    return NextResponse.json(
      { error: "We couldn't sign you in. Please try again." },
      { status: 401 }
    )
  }
}
