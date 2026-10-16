import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { query } from '@/lib/db'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ notebookId: string }> }
) {
  try {
    const { notebookId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await query(
      `
      INSERT INTO public.starred_notebooks (user_id, notebook_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, notebook_id) DO NOTHING
      `,
      [user.id, notebookId]
    )

    return NextResponse.json({ success: true, starred: true })
  } catch (error) {
    console.error('[POST star Error]', error)
    return NextResponse.json({ error: 'Failed to star notebook' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ notebookId: string }> }
) {
  try {
    const { notebookId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await query(
      `DELETE FROM public.starred_notebooks WHERE user_id = $1 AND notebook_id = $2`,
      [user.id, notebookId]
    )

    return NextResponse.json({ success: true, starred: false })
  } catch (error) {
    console.error('[DELETE star Error]', error)
    return NextResponse.json({ error: 'Failed to unstar notebook' }, { status: 500 })
  }
}
