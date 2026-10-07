import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { query } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ notebookId: string }> }
) {
  try {
    const { notebookId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, icon, position } = body

    // Check membership
    const roleRes = await query(
      `
      SELECT
        CASE
          WHEN n.owner_id = $2 THEN 'OWNER'
          ELSE nm.role
        END as role
      FROM public.notebooks n
      LEFT JOIN public.notebook_members nm ON nm.notebook_id = n.id AND nm.user_id = $2
      WHERE n.id = $1 AND n.deleted_at IS NULL
      `,
      [notebookId, user.id]
    )

    const role = roleRes.rows[0]?.role
    if (role !== 'OWNER' && role !== 'EDITOR') {
      return NextResponse.json({ error: 'Only owners and editors can create topics' }, { status: 403 })
    }

    const topicRes = await query(
      `
      INSERT INTO public.topics (notebook_id, title, position, icon, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        notebookId,
        title || 'Untitled Topic',
        position || 1000,
        icon || '📝',
        user.id,
      ]
    )

    return NextResponse.json({
      success: true,
      topic: {
        ...topicRes.rows[0],
        creator: {
          id: user.id,
          name: user.name,
          avatar_url: user.avatar_url,
        },
      },
    })
  } catch (error: any) {
    console.error('[POST /api/notebooks/[id]/topics Error]', error)
    return NextResponse.json({ error: 'Failed to create topic' }, { status: 500 })
  }
}
