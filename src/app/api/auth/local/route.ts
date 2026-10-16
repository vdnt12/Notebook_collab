import { NextRequest, NextResponse } from 'next/server'
import { upsertLocalUser } from '@/lib/db'
import { createAndSetSession } from '@/lib/auth/session'
import { isLocalAuthEnabled } from '@/lib/local-mode'

export async function POST(request: NextRequest) {
  try {
    if (!isLocalAuthEnabled()) {
      return NextResponse.json(
        { error: 'Local sign-in is disabled.' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const email =
      typeof body.email === 'string' && body.email.trim()
        ? body.email.trim().toLowerCase()
        : 'dev@localhost'
    const name =
      typeof body.name === 'string' && body.name.trim()
        ? body.name.trim()
        : 'Local User'

    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    const user = await upsertLocalUser({ email, name })
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
  } catch (error) {
    console.error('[Local Auth Error]', error)
    return NextResponse.json(
      { error: 'Could not start a local session. Check the server logs.' },
      { status: 500 }
    )
  }
}
