import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()

    if (!q) {
      // Return recent topics when query is empty
      const recentRes = await query(
        `
        SELECT
          t.id,
          t.title,
          t.icon,
          t.notebook_id,
          t.updated_at,
          n.name as notebook_name,
          n.icon as notebook_icon
        FROM public.topics t
        JOIN public.notebooks n ON t.notebook_id = n.id
        LEFT JOIN public.notebook_members nm ON nm.notebook_id = n.id AND nm.user_id = $1
        WHERE (n.owner_id = $1 OR nm.user_id = $1)
          AND t.deleted_at IS NULL
          AND n.deleted_at IS NULL
        ORDER BY t.updated_at DESC
        LIMIT 8
        `,
        [user.id]
      )

      return NextResponse.json({
        success: true,
        notebooks: [],
        topics: recentRes.rows || [],
        matches: [],
      })
    }

    const pattern = `%${q}%`

    // Search notebooks
    const nbRes = await query(
      `
      SELECT n.id, n.name, n.description, n.icon, n.color, n.updated_at
      FROM public.notebooks n
      LEFT JOIN public.notebook_members nm ON nm.notebook_id = n.id AND nm.user_id = $1
      WHERE (n.owner_id = $1 OR nm.user_id = $1)
        AND n.deleted_at IS NULL
        AND (n.name ILIKE $2 OR COALESCE(n.description, '') ILIKE $2)
      ORDER BY n.updated_at DESC
      LIMIT 6
      `,
      [user.id, pattern]
    )

    // Search topics by title and content
    const topicsRes = await query(
      `
      SELECT
        t.id,
        t.title,
        t.icon,
        t.notebook_id,
        t.updated_at,
        t.content_text,
        n.name as notebook_name,
        n.icon as notebook_icon
      FROM public.topics t
      JOIN public.notebooks n ON t.notebook_id = n.id
      LEFT JOIN public.notebook_members nm ON nm.notebook_id = n.id AND nm.user_id = $1
      WHERE (n.owner_id = $1 OR nm.user_id = $1)
        AND t.deleted_at IS NULL
        AND n.deleted_at IS NULL
        AND (t.title ILIKE $2 OR COALESCE(t.content_text, '') ILIKE $2)
      ORDER BY t.updated_at DESC
      LIMIT 10
      `,
      [user.id, pattern]
    )

    return NextResponse.json({
      success: true,
      notebooks: nbRes.rows || [],
      topics: topicsRes.rows || [],
    })
  } catch (err) {
    console.error('[GET /api/search Error]', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
