import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { query } from '@/lib/db'
import { createClient as createServerSupabase, isSupabaseConfigured } from '@/lib/supabase/server'
import { can } from '@/lib/permissions'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'application/json',
])

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { topicId } = await params

    // Verify user can read this topic's notebook
    const topicRes = await query<{ notebook_id: string; owner_id: string; user_role: string }>(
      `
      SELECT
        t.notebook_id,
        n.owner_id,
        COALESCE(nm.role, CASE WHEN n.owner_id = $2 THEN 'OWNER' ELSE 'VIEWER' END) as user_role
      FROM public.topics t
      JOIN public.notebooks n ON t.notebook_id = n.id
      LEFT JOIN public.notebook_members nm ON nm.notebook_id = n.id AND nm.user_id = $2
      WHERE t.id = $1 AND t.deleted_at IS NULL AND n.deleted_at IS NULL
      `,
      [topicId, user.id]
    )

    if (!topicRes.rows.length) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    const filesRes = await query<any>(
      `
      SELECT
        f.id,
        f.topic_id,
        f.uploader,
        f.original_filename,
        f.storage_path,
        f.mime_type,
        f.file_size,
        f.created_at,
        p.name as uploader_name,
        p.avatar_url as uploader_avatar
      FROM public.files f
      LEFT JOIN public.profiles p ON f.uploader = p.id
      WHERE f.topic_id = $1
      ORDER BY f.created_at DESC
      `,
      [topicId]
    )

    const files = filesRes.rows || []

    // If Supabase is active, generate short-lived signed URLs for private downloads
    if (isSupabaseConfigured() && files.length > 0) {
      try {
        const supabase = await createServerSupabase()
        for (const file of files) {
          if (file.storage_path) {
            const { data } = await supabase.storage
              .from('notebook-attachments')
              .createSignedUrl(file.storage_path, 3600) // 1 hour validity
            file.download_url = data?.signedUrl || null
          }
        }
      } catch (storageErr) {
        console.error('[Supabase Storage Signed URL Error]', storageErr)
      }
    }

    return NextResponse.json({ success: true, files })
  } catch (error) {
    console.error('[GET /api/topics/[topicId]/files Error]', error)
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { topicId } = await params

    // Verify user can edit this topic's notebook
    const topicRes = await query<{ notebook_id: string; owner_id: string; user_role: string; notebook_name: string }>(
      `
      SELECT
        t.notebook_id,
        n.owner_id,
        n.name as notebook_name,
        COALESCE(nm.role, CASE WHEN n.owner_id = $2 THEN 'OWNER' ELSE 'VIEWER' END) as user_role
      FROM public.topics t
      JOIN public.notebooks n ON t.notebook_id = n.id
      LEFT JOIN public.notebook_members nm ON nm.notebook_id = n.id AND nm.user_id = $2
      WHERE t.id = $1 AND t.deleted_at IS NULL AND n.deleted_at IS NULL
      `,
      [topicId, user.id]
    )

    if (!topicRes.rows.length) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    const { notebook_id, user_role, notebook_name } = topicRes.rows[0]
    const role = (user_role || 'VIEWER') as any

    if (!can(role, 'file:upload')) {
      return NextResponse.json({ error: 'Permission denied: cannot upload files to this notebook' }, { status: 403 })
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
    const originalFilename = file.name || 'attachment'
    const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${notebook_id}/${topicId}/${Date.now()}-${sanitizedFilename}`

    // 1. Upload to Supabase Storage if configured
    let downloadUrl: string | null = null
    if (isSupabaseConfigured()) {
      const supabase = await createServerSupabase()
      const fileBuffer = Buffer.from(await file.arrayBuffer())

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('notebook-attachments')
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: false,
        })

      if (uploadError) {
        console.error('[Supabase Storage Upload Error]', uploadError)
        return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
      }

      const { data: signedData } = await supabase.storage
        .from('notebook-attachments')
        .createSignedUrl(storagePath, 3600)
      downloadUrl = signedData?.signedUrl || null
    }

    // 2. Insert metadata into public.files
    const insertRes = await query<any>(
      `
      INSERT INTO public.files (topic_id, uploader, original_filename, storage_path, mime_type, file_size)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [topicId, user.id, originalFilename, storagePath, mimeType, file.size]
    )

    const createdFile = insertRes.rows[0]

    // Also mirror to notebook_files for backward compatibility
    await query(
      `
      INSERT INTO public.notebook_files (id, notebook_id, uploaded_by, original_name, storage_key, mime_declared, size, preview_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT DO NOTHING
      `,
      [createdFile.id, notebook_id, user.id, originalFilename, storagePath, mimeType, file.size, downloadUrl]
    ).catch(() => {})

    // 3. Log activity
    await query(
      `
      INSERT INTO public.activity (notebook_id, actor, action, metadata)
      VALUES ($1, $2, 'UPLOAD_FILE', $3)
      `,
      [
        notebook_id,
        user.id,
        JSON.stringify({
          topic_id: topicId,
          filename: originalFilename,
          file_id: createdFile.id,
          size: file.size,
        }),
      ]
    ).catch(() => {})

    return NextResponse.json({
      success: true,
      file: {
        ...createdFile,
        download_url: downloadUrl,
        uploader_name: user.name,
        uploader_avatar: user.avatar_url,
      },
    })
  } catch (error: any) {
    console.error('[POST /api/topics/[topicId]/files Error]', error)
    return NextResponse.json({ error: error?.message || 'Failed to upload file' }, { status: 500 })
  }
}
