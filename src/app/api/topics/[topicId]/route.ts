import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { query } from '@/lib/db'

async function getTopicAccess(topicId: string, userId: string) {
  const res = await query(
    `
    SELECT
      t.id,
      t.notebook_id,
      n.owner_id,
      COALESCE(nm.role, CASE WHEN n.owner_id = $2 THEN 'OWNER' ELSE NULL END) as role
    FROM public.topics t
    JOIN public.notebooks n ON n.id = t.notebook_id
    LEFT JOIN public.notebook_members nm ON nm.notebook_id = n.id AND nm.user_id = $2
    WHERE t.id = $1 AND n.deleted_at IS NULL
    LIMIT 1
    `,
    [topicId, userId]
  )
  return res.rows[0] as
    | { id: string; notebook_id: string; owner_id: string; role: string | null }
    | undefined
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  try {
    const { topicId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const access = await getTopicAccess(topicId, user.id)
    if (!access?.role) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    const res = await query(
      `
      SELECT t.*, u.name as creator_name, u.avatar_url as creator_avatar_url
      FROM public.topics t
      LEFT JOIN public.users u ON t.created_by = u.id
      WHERE t.id = $1 AND t.deleted_at IS NULL
      LIMIT 1
      `,
      [topicId]
    )

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    const row = res.rows[0]
    return NextResponse.json({
      success: true,
      topic: {
        ...row,
        creator: {
          id: row.created_by,
          name: row.creator_name,
          avatar_url: row.creator_avatar_url,
        },
      },
    })
  } catch (error) {
    console.error('[GET /api/topics/[topicId] Error]', error)
    return NextResponse.json({ error: 'Failed to fetch topic' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  try {
    const { topicId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const access = await getTopicAccess(topicId, user.id)
    if (!access?.role) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    const body = await request.json()
    const { title, icon, content, content_text, deleted_at } = body

    if (deleted_at && access.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only owners can delete topics' }, { status: 403 })
    }

    if (access.role !== 'OWNER' && access.role !== 'EDITOR') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const res = await query(
      `
      UPDATE public.topics
      SET
        title = COALESCE($2, title),
        icon = COALESCE($3, icon),
        content = COALESCE($4, content),
        content_text = COALESCE($5, content_text),
        deleted_at = CASE WHEN $6::boolean THEN NOW() ELSE deleted_at END,
        deleted_by = CASE WHEN $6::boolean THEN $7 ELSE deleted_by END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        topicId,
        typeof title === 'string' ? title.trim() : null,
        typeof icon === 'string' ? icon.trim() : null,
        content ? JSON.stringify(content) : null,
        typeof content_text === 'string' ? content_text.slice(0, 500) : null,
        Boolean(deleted_at),
        user.id,
      ]
    )

    // Log activity if edited or deleted
    if (res.rows.length > 0) {
      const topicRow = res.rows[0]
      const actionName = deleted_at ? 'DELETE_TOPIC' : (title ? 'RENAME_TOPIC' : 'EDIT_TOPIC')
      await query(
        `
        INSERT INTO public.activity (notebook_id, actor, action, metadata)
        VALUES ($1, $2, $3, $4)
        `,
        [
          access.notebook_id,
          user.id,
          actionName,
          JSON.stringify({
            topic_id: topicId,
            topicTitle: topicRow.title,
          }),
        ]
      ).catch(() => {})
    }

    return NextResponse.json({ success: true, topic: res.rows[0] })
  } catch (error) {
    console.error('[PATCH /api/topics/[topicId] Error]', error)
    return NextResponse.json({ error: 'Failed to update topic' }, { status: 500 })
  }
}
