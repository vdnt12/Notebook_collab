import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { query } from '@/lib/db'
import { createClient as createServerSupabase, isSupabaseConfigured } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ notebookId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { notebookId } = await params

    // Verify user can read notebook
    const nbRes = await query<{ id: string; owner_id: string; user_role: string }>(
      `
      SELECT
        n.id,
        n.owner_id,
        COALESCE(nm.role, CASE WHEN n.owner_id = $2 THEN 'OWNER' ELSE 'VIEWER' END) as user_role
      FROM public.notebooks n
      LEFT JOIN public.notebook_members nm ON nm.notebook_id = n.id AND nm.user_id = $2
      WHERE n.id = $1 AND (n.owner_id = $2 OR nm.user_id = $2) AND n.deleted_at IS NULL
      `,
      [notebookId, user.id]
    )

    if (!nbRes.rows.length) {
      return NextResponse.json({ error: 'Notebook not found or access denied' }, { status: 404 })
    }

    const filesRes = await query<any>(
      `
      SELECT
        nf.id,
        nf.notebook_id,
        nf.uploaded_by,
        nf.original_name,
        nf.storage_key,
        nf.mime_declared,
        nf.size,
        nf.status,
        nf.preview_url,
        nf.created_at,
        p.name as uploader_name,
        p.avatar_url as uploader_avatar
      FROM public.notebook_files nf
      LEFT JOIN public.profiles p ON nf.uploaded_by = p.id
      WHERE nf.notebook_id = $1 AND nf.deleted_at IS NULL
      ORDER BY nf.created_at DESC
      `,
      [notebookId]
    )

    const files = filesRes.rows || []

    // Renew signed URLs if Supabase is active
    if (isSupabaseConfigured() && files.length > 0) {
      try {
        const supabase = await createServerSupabase()
        for (const f of files) {
          if (f.storage_key) {
            const { data } = await supabase.storage
              .from('notebook-attachments')
              .createSignedUrl(f.storage_key, 3600)
            if (data?.signedUrl) {
              f.preview_url = data.signedUrl
            }
          }
        }
      } catch (storageErr) {
        console.error('[Supabase Storage Signed URL Error]', storageErr)
      }
    }

    return NextResponse.json({ success: true, files })
  } catch (error) {
    console.error('[GET /api/notebooks/[notebookId]/files Error]', error)
    return NextResponse.json({ error: 'Failed to fetch notebook files' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ notebookId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { notebookId } = await params

    const nbRes = await query<{ id: string; owner_id: string; user_role: string }>(
      `
      SELECT
        n.id,
        n.owner_id,
        COALESCE(nm.role, CASE WHEN n.owner_id = $2 THEN 'OWNER' ELSE 'VIEWER' END) as user_role
      FROM public.notebooks n
      LEFT JOIN public.notebook_members nm ON nm.notebook_id = n.id AND nm.user_id = $2
      WHERE n.id = $1 AND (n.owner_id = $2 OR nm.user_id = $2) AND n.deleted_at IS NULL
      `,
      [notebookId, user.id]
    )

    if (!nbRes.rows.length) {
      return NextResponse.json({ error: 'Notebook not found or access denied' }, { status: 404 })
    }

    const { user_role } = nbRes.rows[0]
    const role = (user_role || 'VIEWER') as any

    if (!can(role, 'file:upload')) {
      return NextResponse.json({ error: 'Permission denied: cannot upload files' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size exceeds the 25MB limit (provided: ${(file.size / (1024 * 1024)).toFixed(1)}MB)` },
        { status: 400 }
      )
    }

    const mimeType = file.type || 'application/octet-stream'
    const originalName = file.name || 'file'
    const sanitizedFilename = originalName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storageKey = `${notebookId}/attachments/${Date.now()}-${sanitizedFilename}`

    let previewUrl: string | null = null

    // 1. Upload to Supabase Storage if configured
    if (isSupabaseConfigured()) {
      const supabase = await createServerSupabase()
      const buffer = Buffer.from(await file.arrayBuffer())

      const { error: uploadError } = await supabase.storage
        .from('notebook-attachments')
        .upload(storageKey, buffer, {
          contentType: mimeType,
          upsert: false,
        })

      if (uploadError) {
        console.error('[Supabase Storage Upload Error]', uploadError)
        return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
      }

      const { data: signedData } = await supabase.storage
        .from('notebook-attachments')
        .createSignedUrl(storageKey, 3600)
      previewUrl = signedData?.signedUrl || null
    }

    // 2. Insert into database
    const insertRes = await query<any>(
      `
      INSERT INTO public.notebook_files (notebook_id, uploaded_by, original_name, storage_key, mime_declared, size, preview_url, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'ready')
      RETURNING *
      `,
      [notebookId, user.id, originalName, storageKey, mimeType, file.size, previewUrl]
    )

    const createdFile = insertRes.rows[0]

    // 3. Log activity
    await query(
      `
      INSERT INTO public.activity (notebook_id, actor, action, metadata)
      VALUES ($1, $2, 'UPLOAD_FILE', $3)
      `,
      [
        notebookId,
        user.id,
        JSON.stringify({
          filename: originalName,
          file_id: createdFile.id,
          size: file.size,
        }),
      ]
    ).catch(() => {})

    return NextResponse.json({
      success: true,
      file: {
        ...createdFile,
        uploader_name: user.name,
        uploader_avatar: user.avatar_url,
      },
    })
  } catch (error: any) {
    console.error('[POST /api/notebooks/[notebookId]/files Error]', error)
    return NextResponse.json({ error: error?.message || 'Failed to upload file' }, { status: 500 })
  }
}
