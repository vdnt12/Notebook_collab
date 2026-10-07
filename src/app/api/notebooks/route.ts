import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { query } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, icon, color } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Notebook name is required' }, { status: 400 })
    }

    const nbRes = await query(
      `
      INSERT INTO public.notebooks (name, description, icon, color, owner_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        name.trim(),
        description?.trim() || null,
        icon || '📓',
        color || '#6366f1',
        user.id,
      ]
    )

    const notebook = nbRes.rows[0]

    // Create default notebook settings
    await query(
      `
      INSERT INTO public.notebook_settings (notebook_id, editors_can_delete, allow_viewer_download, allow_link_access)
      VALUES ($1, false, true, false)
      ON CONFLICT DO NOTHING
      `,
      [notebook.id]
    )

    // Create owner membership
    await query(
      `
      INSERT INTO public.notebook_members (notebook_id, user_id, role)
      VALUES ($1, $2, 'OWNER')
      ON CONFLICT DO NOTHING
      `,
      [notebook.id, user.id]
    )

    // Create an initial starter topic
    const topicRes = await query(
      `
      INSERT INTO public.topics (notebook_id, title, position, icon, created_by)
      VALUES ($1, 'Getting Started', 1000, '✨', $2)
      RETURNING *
      `,
      [notebook.id, user.id]
    )

    return NextResponse.json({
      success: true,
      notebook: {
        ...notebook,
        user_role: 'OWNER',
        member_count: 1,
        topic_count: 1,
        is_starred: false,
      },
      topic: topicRes.rows[0],
    })
  } catch (error: any) {
    console.error('[POST /api/notebooks Error]', error)
    return NextResponse.json({ error: 'Failed to create notebook' }, { status: 500 })
  }
}
