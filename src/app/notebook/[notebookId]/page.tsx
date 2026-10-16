import { requireAuth } from '@/lib/auth/session'
import { query } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { NotebookShell } from '@/components/notebook/NotebookShell'
import type { Notebook, Topic, NotebookMember, Profile, NotebookRole } from '@/types'

interface PageProps {
  params: Promise<{ notebookId: string }>
}

export default async function NotebookPage({ params }: PageProps) {
  const { notebookId } = await params
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

  // Fetch notebook
  const nbRes = await query<any>(
    `
    SELECT n.*, u.name as owner_name, u.email as owner_email, u.avatar_url as owner_avatar_url
    FROM public.notebooks n
    JOIN public.users u ON n.owner_id = u.id
    WHERE n.id = $1 AND n.deleted_at IS NULL
    LIMIT 1
    `,
    [notebookId]
  )

  const notebook = nbRes.rows[0]
  if (!notebook) {
    notFound()
  }

  // Determine user role
  let userRole: NotebookRole = 'VIEWER'
  if (notebook.owner_id === user.id) {
    userRole = 'OWNER'
  } else {
    const memRes = await query(
      `SELECT role FROM public.notebook_members WHERE notebook_id = $1 AND user_id = $2 LIMIT 1`,
      [notebookId, user.id]
    )
    const membership = memRes.rows[0]
    if (!membership) {
      redirect('/dashboard')
    }
    userRole = membership.role as NotebookRole
  }

  // Fetch notebook members
  const membersRes = await query(
    `
    SELECT
      nm.*,
      json_build_object(
        'id', u.id,
        'name', u.name,
        'email', u.email,
        'avatar_url', u.avatar_url
      ) as profile
    FROM public.notebook_members nm
    JOIN public.users u ON nm.user_id = u.id
    WHERE nm.notebook_id = $1
    `,
    [notebookId]
  )
  const members = membersRes.rows || []

  // Fetch topics
  const topicsRes = await query(
    `
    SELECT
      t.*,
      json_build_object(
        'id', u.id,
        'name', u.name,
        'avatar_url', u.avatar_url
      ) as creator
    FROM public.topics t
    LEFT JOIN public.users u ON t.created_by = u.id
    WHERE t.notebook_id = $1 AND t.deleted_at IS NULL
    ORDER BY t.position ASC
    `,
    [notebookId]
  )
  const topics = topicsRes.rows || []

  const notebookWithRole: Notebook & { user_role: NotebookRole } = {
    ...notebook,
    user_role: userRole,
    owner: {
      id: notebook.owner_id,
      google_id: null,
      name: notebook.owner_name,
      email: notebook.owner_email,
      avatar_url: notebook.owner_avatar_url,
      created_at: notebook.created_at,
      updated_at: notebook.updated_at,
      last_active_at: null,
    },
  }

  return (
    <NotebookShell
      notebook={notebookWithRole}
      topics={topics as Topic[]}
      members={members as NotebookMember[]}
      currentUser={userProfile}
      userId={user.id}
    />
  )
}
