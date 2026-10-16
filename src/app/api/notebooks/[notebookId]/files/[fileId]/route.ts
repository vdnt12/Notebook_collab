import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { query } from '@/lib/db'
import { createClient as createServerSupabase, isSupabaseConfigured } from '@/lib/supabase/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ notebookId: string; fileId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { notebookId, fileId } = await params

    const fileRes = await query<any>(
      `
      SELECT nf.*, n.owner_id
      FROM public.notebook_files nf
      JOIN public.notebooks n ON nf.notebook_id = n.id
      WHERE nf.id = $1 AND nf.notebook_id = $2
      `,
      [fileId, notebookId]
    )

    if (!fileRes.rows.length) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = fileRes.rows[0]

    // Only uploader or notebook owner can delete
    if (file.uploaded_by !== user.id && file.owner_id !== user.id) {
      return NextResponse.json({ error: 'Permission denied: cannot delete this file' }, { status: 403 })
    }

    if (isSupabaseConfigured() && file.storage_key) {
      try {
        const supabase = await createServerSupabase()
        await supabase.storage.from('notebook-attachments').remove([file.storage_key])
      } catch (err) {
        console.error('[Supabase Storage Delete File Error]', err)
      }
    }

    await query(`DELETE FROM public.notebook_files WHERE id = $1`, [fileId])
    await query(`DELETE FROM public.files WHERE id = $1`, [fileId]).catch(() => {})

    await query(
      `
      INSERT INTO public.activity (notebook_id, actor, action, metadata)
      VALUES ($1, $2, 'DELETE_FILE', $3)
      `,
      [
        notebookId,
        user.id,
        JSON.stringify({
          filename: file.original_name,
        }),
      ]
    ).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/notebooks/[notebookId]/files/[fileId] Error]', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
