import { requireAuth } from '@/lib/auth/session'
import { query } from '@/lib/db'
import { DashboardContent } from '@/components/dashboard/DashboardContent'
import type { Notebook, Profile } from '@/types'

export default async function SharedPage() {
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

  let sharedNotebooks: Notebook[] = []

  try {
    const res = await query(
      `
      SELECT
        n.*,
        nm.role as user_role,
        EXISTS(SELECT 1 FROM public.starred_notebooks sn WHERE sn.notebook_id = n.id AND sn.user_id = $1) as is_starred
      FROM public.notebook_members nm
      JOIN public.notebooks n ON nm.notebook_id = n.id
      WHERE nm.user_id = $1 AND n.deleted_at IS NULL
      ORDER BY n.updated_at DESC
      `,
      [user.id]
    )

    sharedNotebooks = (res.rows || []).map((nb) => ({
      ...nb,
      user_role: nb.user_role,
      is_starred: Boolean(nb.is_starred),
    }))
  } catch (err) {
    console.error('[SharedPage Query Error]', err)
  }

  return (
    <DashboardContent
      notebooks={[]}
      sharedNotebooks={sharedNotebooks}
      userId={user.id}
      profile={userProfile}
      greeting="Shared With Me"
    />
  )
}
