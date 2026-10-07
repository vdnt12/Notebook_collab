import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { query } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ notebookId: string }> }
) {
  try {
    const { notebookId } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const checkRes = await query(
      `SELECT owner_id FROM public.notebooks WHERE id = $1 AND deleted_at IS NULL`,
      [notebookId]
    )

    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 })
    }

    if (checkRes.rows[0].owner_id !== user.id) {
      return NextResponse.json({ error: 'Only the notebook owner can delete it' }, { status: 403 })
    }

    // Soft delete
    await query(
      `UPDATE public.notebooks SET deleted_at = NOW(), deleted_by = $2 WHERE id = $1`,
      [notebookId, user.id]
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[DELETE /api/notebooks/[id] Error]', error)
    return NextResponse.json({ error: 'Failed to delete notebook' }, { status: 500 })
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

    const body = await request.json()
    const { name, description, icon, color } = body

    // Verify user is OWNER or EDITOR
    const roleRes = await query(
      `
      SELECT
        CASE
          WHEN n.owner_id = $2 THEN 'OWNER'
          ELSE nm.role
        END as role
      FROM public.notebooks n
      LEFT JOIN public.notebook_members nm ON nm.notebook_id = n.id AND nm.user_id = $2
      WHERE n.id = $1 AND n.deleted_at IS NULL
      `,
      [notebookId, user.id]
    )

    const role = roleRes.rows[0]?.role
    if (role !== 'OWNER' && role !== 'EDITOR') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const updateRes = await query(
      `
      UPDATE public.notebooks
      SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        icon = COALESCE($4, icon),
        color = COALESCE($5, color),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [notebookId, name, description, icon, color]
    )

    return NextResponse.json({ success: true, notebook: updateRes.rows[0] })
  } catch (error: any) {
    console.error('[PATCH /api/notebooks/[id] Error]', error)
    return NextResponse.json({ error: 'Failed to update notebook' }, { status: 500 })
  }
}
