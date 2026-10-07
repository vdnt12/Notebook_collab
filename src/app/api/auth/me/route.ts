import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
    })
  } catch (error) {
    console.error('[GET /api/auth/me Error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
