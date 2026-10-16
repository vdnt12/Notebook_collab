import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { query } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ notebookId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { notebookId } = await params

    // Verify user can access notebook
    const nbRes = await query(
      `
      SELECT n.id
      FROM public.notebooks n
      LEFT JOIN public.notebook_members nm ON nm.notebook_id = n.id AND nm.user_id = $2
      WHERE n.id = $1 AND (n.owner_id = $2 OR nm.user_id = $2) AND n.deleted_at IS NULL
      `,
      [notebookId, user.id]
    )

    if (!nbRes.rows.length) {
      return NextResponse.json({ error: 'Notebook not found or access denied' }, { status: 404 })
    }

    const actRes = await query<any>(
      `
      SELECT
        a.id,
        a.notebook_id,
        a.actor,
        a.action,
        a.metadata,
        a.timestamp,
        p.name as actor_name,
        p.avatar_url as actor_avatar
      FROM public.activity a
      LEFT JOIN public.profiles p ON a.actor = p.id
      WHERE a.notebook_id = $1
      ORDER BY a.timestamp DESC
      LIMIT 50
      `,
      [notebookId]
    )

    return NextResponse.json({
      success: true,
      activities: actRes.rows || [],
    })
  } catch (error) {
    console.error('[GET /api/notebooks/[notebookId]/activity Error]', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
