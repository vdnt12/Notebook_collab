import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { query, seedStarterNotebooks } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure seed data for user if empty
    await seedStarterNotebooks(user.id).catch(() => {})

    // Fetch owned and shared notebooks
    const notebooksRes = await query(
      `
      SELECT
        n.*,
        COALESCE(nm.role, CASE WHEN n.owner_id = $1 THEN 'OWNER' ELSE 'VIEWER' END) as user_role,
        COUNT(DISTINCT nm.id)::int as member_count,
        COUNT(DISTINCT t.id)::int as topic_count,
        EXISTS(SELECT 1 FROM public.starred_notebooks sn WHERE sn.notebook_id = n.id AND sn.user_id = $1) as is_starred
      FROM public.notebooks n
      LEFT JOIN public.notebook_members nm ON nm.notebook_id = n.id AND nm.user_id = $1
      LEFT JOIN public.topics t ON t.notebook_id = n.id AND t.deleted_at IS NULL
      WHERE (n.owner_id = $1 OR nm.user_id = $1) AND n.deleted_at IS NULL
      GROUP BY n.id, nm.role
      ORDER BY n.updated_at DESC
      `,
      [user.id]
    )

    // Fetch topics for these notebooks
    const topicsRes = await query(
      `
      SELECT t.id, t.notebook_id, t.title, t.icon, t.position, t.updated_at
      FROM public.topics t
      JOIN public.notebooks n ON t.notebook_id = n.id
      LEFT JOIN public.notebook_members nm ON nm.notebook_id = n.id AND nm.user_id = $1
      WHERE (n.owner_id = $1 OR nm.user_id = $1) AND t.deleted_at IS NULL AND n.deleted_at IS NULL
      ORDER BY t.position ASC
      `,
      [user.id]
    )

    const topicsByNotebook = new Map<string, any[]>()
    for (const top of topicsRes.rows || []) {
      if (!topicsByNotebook.has(top.notebook_id)) {
        topicsByNotebook.set(top.notebook_id, [])
      }
      topicsByNotebook.get(top.notebook_id)!.push(top)
    }

    const notebooks = (notebooksRes.rows || []).map(nb => ({
      ...nb,
      member_count: nb.member_count || 1,
      topic_count: (topicsByNotebook.get(nb.id) || []).length,
      is_starred: Boolean(nb.is_starred),
      topics: topicsByNotebook.get(nb.id) || [],
    }))

    return NextResponse.json({
      success: true,
      notebooks,
    })
  } catch (err) {
    console.error('[GET /api/notebooks Error]', err)
    return NextResponse.json({ error: 'Failed to fetch notebooks' }, { status: 500 })
  }
}

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
