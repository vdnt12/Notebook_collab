import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { query } from '@/lib/db'

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

    const res = await query(
      `
      SELECT c.*, u.name as author_name, u.avatar_url as author_avatar_url
      FROM public.comments c
      JOIN public.users u ON c.author_id = u.id
      WHERE c.topic_id = $1
      ORDER BY c.created_at ASC
      `,
      [topicId]
    )

    return NextResponse.json({
      success: true,
      comments: (res.rows || []).map(r => ({
        id: r.id,
        author: r.author_name,
        avatar_url: r.author_avatar_url,
        text: r.content,
        resolved: r.resolved,
        time: r.created_at,
      })),
    })
  } catch (error) {
    console.error('[GET comments Error]', error)
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  try {
    const { topicId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { content, notebookId } = body

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 })
    }

    let nbId = notebookId
    if (!nbId) {
      const topRes = await query(`SELECT notebook_id FROM public.topics WHERE id = $1`, [topicId])
      nbId = topRes.rows[0]?.notebook_id
    }

    const res = await query(
      `
      INSERT INTO public.comments (notebook_id, topic_id, author_id, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [nbId, topicId, user.id, content.trim()]
    )

    return NextResponse.json({
      success: true,
      comment: {
        id: res.rows[0].id,
        author: user.name,
        avatar_url: user.avatar_url,
        text: content.trim(),
        resolved: false,
        time: res.rows[0].created_at,
      },
    })
  } catch (error) {
    console.error('[POST comment Error]', error)
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
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

    const body = await request.json()
    const { commentId, resolved } = body

    await query(
      `
      UPDATE public.comments
      SET resolved = $2, updated_at = NOW()
      WHERE id = $1 AND topic_id = $3
      `,
      [commentId, Boolean(resolved), topicId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH comment Error]', error)
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 })
  }
}
