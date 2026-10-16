import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { query } from '@/lib/db'
import { createClient as createServerSupabase, isSupabaseConfigured } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string; fileId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { topicId, fileId } = await params

    const fileRes = await query<any>(
      `
      SELECT
        f.*,
        t.notebook_id,
        n.owner_id
      FROM public.files f
      JOIN public.topics t ON f.topic_id = t.id
      JOIN public.notebooks n ON t.notebook_id = n.id
      LEFT JOIN public.notebook_members nm ON nm.notebook_id = n.id AND nm.user_id = $2
      WHERE f.id = $1 AND f.topic_id = $3 AND (n.owner_id = $2 OR nm.user_id = $2)
      `,
      [fileId, user.id, topicId]
    )

    if (!fileRes.rows.length) {
      return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 })
    }

    const file = fileRes.rows[0]
    let downloadUrl: string | null = null

    if (isSupabaseConfigured() && file.storage_path) {
      const supabase = await createServerSupabase()
      const { data, error } = await supabase.storage
        .from('notebook-attachments')
        .createSignedUrl(file.storage_path, 3600)
      if (error) {
        console.error('[Supabase Storage createSignedUrl error]', error)
      } else {
        downloadUrl = data?.signedUrl || null
      }
    }

    return NextResponse.json({
      success: true,
      file: {
        ...file,
        download_url: downloadUrl,
      },
    })
  } catch (error) {
    console.error('[GET /api/topics/[topicId]/files/[fileId] Error]', error)
    return NextResponse.json({ error: 'Failed to retrieve file' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string; fileId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { topicId, fileId } = await params

    const fileRes = await query<any>(
      `
      SELECT
        f.*,
        t.notebook_id,
        n.owner_id
      FROM public.files f
      JOIN public.topics t ON f.topic_id = t.id
      JOIN public.notebooks n ON t.notebook_id = n.id
      WHERE f.id = $1 AND f.topic_id = $2
      `,
      [fileId, topicId]
    )

    if (!fileRes.rows.length) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = fileRes.rows[0]

    // Only file uploader or notebook owner can delete
    if (file.uploader !== user.id && file.owner_id !== user.id) {
      return NextResponse.json({ error: 'Permission denied: cannot delete this file' }, { status: 403 })
    }

    // 1. Delete from Supabase Storage if configured
    if (isSupabaseConfigured() && file.storage_path) {
      try {
        const supabase = await createServerSupabase()
        await supabase.storage.from('notebook-attachments').remove([file.storage_path])
      } catch (err) {
        console.error('[Supabase Storage Delete Warning]', err)
      }
    }

    // 2. Delete database records
    await query(`DELETE FROM public.files WHERE id = $1`, [fileId])
    await query(`DELETE FROM public.notebook_files WHERE id = $1`, [fileId]).catch(() => {})

    // 3. Log activity
    await query(
      `
      INSERT INTO public.activity (notebook_id, actor, action, metadata)
      VALUES ($1, $2, 'DELETE_FILE', $3)
      `,
      [
        file.notebook_id,
        user.id,
        JSON.stringify({
          topic_id: topicId,
          filename: file.original_filename,
        }),
      ]
    ).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/topics/[topicId]/files/[fileId] Error]', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
