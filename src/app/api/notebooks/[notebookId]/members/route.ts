import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getUserByEmail, query } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ notebookId: string }> }
) {
  try {
    const { notebookId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ownerRes = await query(
      `SELECT owner_id FROM public.notebooks WHERE id = $1 AND deleted_at IS NULL`,
      [notebookId]
    )
    if (ownerRes.rows[0]?.owner_id !== user.id) {
      return NextResponse.json({ error: 'Only the owner can add members' }, { status: 403 })
    }

    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const role = body.role === 'VIEWER' || body.role === 'COMMENTER' ? body.role : 'EDITOR'

    const invitee = await getUserByEmail(email)
    if (!invitee) {
      return NextResponse.json(
        { error: 'No local user found with that email. They need to sign in first.' },
        { status: 404 }
      )
    }

    if (invitee.id === user.id) {
      return NextResponse.json({ error: 'You already own this notebook' }, { status: 400 })
    }

    const memberRes = await query(
      `
      INSERT INTO public.notebook_members (notebook_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (notebook_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()
      RETURNING *
      `,
      [notebookId, invitee.id, role]
    )

    return NextResponse.json({
      success: true,
      member: {
        ...memberRes.rows[0],
        profile: {
          id: invitee.id,
          name: invitee.name,
          email: invitee.email,
          avatar_url: invitee.avatar_url,
        },
      },
    })
  } catch (error) {
    console.error('[POST members Error]', error)
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ notebookId: string }> }
) {
  try {
    const { notebookId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ownerRes = await query(
      `SELECT owner_id FROM public.notebooks WHERE id = $1 AND deleted_at IS NULL`,
      [notebookId]
    )
    if (ownerRes.rows[0]?.owner_id !== user.id) {
      return NextResponse.json({ error: 'Only the owner can change members' }, { status: 403 })
    }

    const body = await request.json()
    const memberId = body.memberId
    const role = body.role

    if (role === 'REMOVE') {
      await query(`DELETE FROM public.notebook_members WHERE id = $1 AND notebook_id = $2`, [
        memberId,
        notebookId,
      ])
      return NextResponse.json({ success: true, removed: true })
    }

    const res = await query(
      `
      UPDATE public.notebook_members
      SET role = $3, updated_at = NOW()
      WHERE id = $1 AND notebook_id = $2
      RETURNING *
      `,
      [memberId, notebookId, role]
    )

    return NextResponse.json({ success: true, member: res.rows[0] })
  } catch (error) {
    console.error('[PATCH members Error]', error)
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
  }
}
