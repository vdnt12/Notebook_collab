import { requireAuth } from '@/lib/auth/session'
import { query } from '@/lib/db'
import { DashboardContent } from '@/components/dashboard/DashboardContent'
import type { Notebook, Profile } from '@/types'

export default async function NotebooksPage() {
  const user = await requireAuth()

  const userProfile: Profile = {
    id: user.id,
    google_id: user.google_sub,
    name: user.name,
    email: user.email,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_active_at: user.last_active_at,
  }

  let mappedNotebooks: Notebook[] = []

  try {
    const res = await query(
      `
      SELECT
        n.*,
        COUNT(DISTINCT nm.id)::int as member_count,
        COUNT(DISTINCT t.id)::int as topic_count,
        EXISTS(SELECT 1 FROM public.starred_notebooks sn WHERE sn.notebook_id = n.id AND sn.user_id = $1) as is_starred
      FROM public.notebooks n
      LEFT JOIN public.notebook_members nm ON nm.notebook_id = n.id
      LEFT JOIN public.topics t ON t.notebook_id = n.id AND t.deleted_at IS NULL
      WHERE n.owner_id = $1 AND n.deleted_at IS NULL
      GROUP BY n.id
      ORDER BY n.updated_at DESC
      `,
      [user.id]
    )

    mappedNotebooks = (res.rows || []).map((nb) => ({
      ...nb,
      user_role: 'OWNER' as const,
      member_count: nb.member_count || 1,
      topic_count: nb.topic_count || 0,
      is_starred: Boolean(nb.is_starred),
    }))
  } catch (err) {
    console.error('[NotebooksPage Query Error]', err)
  }

  return (
    <DashboardContent
      notebooks={mappedNotebooks}
      sharedNotebooks={[]}
      userId={user.id}
      profile={userProfile}
      greeting="My Notebooks"
    />
  )
}
