import { requireAuth } from '@/lib/auth/session'
import { query } from '@/lib/db'
import { DashboardContent } from '@/components/dashboard/DashboardContent'
import type { Notebook, Profile } from '@/types'

export default async function StarredPage() {
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

  let starredNotebooks: Notebook[] = []

  try {
    const res = await query<any>(
      `
      SELECT
        n.*,
        COALESCE(nm.role, CASE WHEN n.owner_id = $1 THEN 'OWNER' ELSE 'VIEWER' END) as user_role,
        true as is_starred
      FROM public.starred_notebooks sn
      JOIN public.notebooks n ON sn.notebook_id = n.id
      LEFT JOIN public.notebook_members nm ON nm.notebook_id = n.id AND nm.user_id = $1
      WHERE sn.user_id = $1 AND n.deleted_at IS NULL
      ORDER BY sn.created_at DESC
      `,
      [user.id]
    )

    starredNotebooks = (res.rows || []).map((nb: any) => ({
      ...nb,
      user_role: nb.user_role,
      is_starred: true,
    }))
  } catch (err) {
    console.error('[StarredPage Query Error]', err)
  }

  return (
    <DashboardContent
      notebooks={starredNotebooks}
      sharedNotebooks={[]}
      userId={user.id}
      profile={userProfile}
      greeting="Starred Notebooks"
    />
  )
}
