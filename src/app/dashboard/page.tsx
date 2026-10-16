import { requireAuth } from '@/lib/auth/session'
import { query, seedStarterNotebooks } from '@/lib/db'
import { DashboardContent } from '@/components/dashboard/DashboardContent'
import type { Notebook, Profile, Topic } from '@/types'

export default async function DashboardPage() {
  const user = await requireAuth()
  await seedStarterNotebooks(user.id).catch(() => {})

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

  let ownedNotebooks: Notebook[] = []
  let sharedNotebooks: Notebook[] = []
  let recentTopics: (Topic & { notebook_name: string; notebook_icon: string })[] = []

  try {
    const ownedRes = await query<any>(
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

    ownedNotebooks = (ownedRes.rows || []).map((nb: any) => ({
      ...nb,
      user_role: 'OWNER' as const,
      member_count: nb.member_count || 1,
      topic_count: nb.topic_count || 0,
      is_starred: Boolean(nb.is_starred),
    }))

    const sharedRes = await query<any>(
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

    sharedNotebooks = (sharedRes.rows || []).map((nb: any) => ({
      ...nb,
      user_role: nb.user_role,
      is_starred: Boolean(nb.is_starred),
    }))

    const topicsRes = await query<any>(
      `
      SELECT
        t.id,
        t.title,
        t.icon,
        t.notebook_id,
        t.updated_at,
        t.created_at,
        t.position,
        t.created_by,
        t.content_text,
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

    recentTopics = topicsRes.rows || []
  } catch (err) {
    console.error('[DashboardPage Query Error]', err)
  }

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <DashboardContent
      notebooks={ownedNotebooks}
      sharedNotebooks={sharedNotebooks}
      recentTopics={recentTopics}
      userId={user.id}
      profile={userProfile}
      greeting={greeting}
    />
  )
}
